import { IStorageService, Result, UploadData, WebdavConfig } from "../types";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { handleError } from "../common/ErrorHandler";
import { ConfigChangeListener,StorageServiceType,StorageServiceConstructor } from "../types";
import { logger } from "../common/Logger";
import { requestUrl, RequestUrlParam, App, normalizePath } from "obsidian";
import { AmazonS3StorageService } from "./providers/AmazonS3StorageService";
import { AliyunOSSStorageService } from "./providers/AliyunOSSStorageService";
import { TencentCOSStorageService } from "./providers/TencentCOSStorageService";
import { CloudflareR2StorageService } from "./providers/CloudflareR2StorageService";
import { WebdavStorageService } from "./providers/WebdavStorageService";

export const StorageServiceTypeInfo: Record<
  string,
  { clazz: StorageServiceConstructor; serviceName: string }
> = {
  [StorageServiceType.AMAZON_S3]: {
    clazz: AmazonS3StorageService,
    serviceName: "Amazon S3",
  },
  [StorageServiceType.CLOUDFLARE_R2]: {
    clazz: CloudflareR2StorageService,
    serviceName: "Cloudflare R2",
  },
  [StorageServiceType.ALIYUN_OSS]: {
    clazz: AliyunOSSStorageService,
    serviceName: "Aliyun OSS",
  },
  [StorageServiceType.TENCENT_COS]: {
    clazz: TencentCOSStorageService,
    serviceName: "Tencent COS",
  },
  [StorageServiceType.WEBDAV]: {
    clazz: WebdavStorageService,
    serviceName: "WebDAV",
  },
};


/**
 * Manages upload service instances and operations
 * Handles file uploads, deletions, and storage operations
 * Acts as a factory and cache for uploader instances
 */
export class StorageServiceManager {
  private configurationManager: ConfigurationManager;
  private serviceInstances: Map<string, IStorageService> = new Map();

  constructor(configurationManager: ConfigurationManager) {
    this.configurationManager = configurationManager;
    this.initializeConfigChangeListener();
  }

  /**
   * Initialize configuration change listener
   * Clears cached service instances when configuration changes
   */
  private initializeConfigChangeListener(): void {
    const configChangeListener: ConfigChangeListener = () => {
      this.dispose();
    };

    this.configurationManager.addConfigChangeListener(configChangeListener);
  }

  /**
   * Get or create an service instance for the current storage service
   * Implements lazy initialization and caching pattern
   * @returns Configured service instance
   */
  getService(): IStorageService {
    const serviceType = this.configurationManager.getCurrentStorageService();
    const cached = this.serviceInstances.get(serviceType);
    if (cached) {
      return cached;
    }

    logger.debug("StorageServiceManager", "Creating new service instance", {
      serviceType,
    });

    const config = this.configurationManager.getCurrentStorageConfig();
    const storageServiceTypeInfo = StorageServiceTypeInfo[serviceType];
    if (!storageServiceTypeInfo) {
      throw new Error(`Unknown service type: ${serviceType}`);
    }
    const ServiceClass: StorageServiceConstructor =
      storageServiceTypeInfo.clazz;
    const service = new ServiceClass(config);
    this.serviceInstances.set(serviceType, service);
    return service;
  }

  /**
   * Validate current connection configuration
   * Checks if required configuration fields are present
   * @returns Result indicating validation success or failure
   */
  checkConnectionConfig(): Result {
    try {
      const service = this.getService();
      const result = service.checkConnectionConfig();

      if (result.success) {
        logger.debug(
          "StorageServiceManager",
          "Check Connection config successful",
        );
      } else {
        logger.error(
          "StorageServiceManager",
          "Check Connection config failed",
          result.error,
        );
      }

      return result;
    } catch (error) {
      const errorMessage = `Check Connection config error: ${error instanceof Error ? error.message : String(error)}`;
      logger.error("StorageServiceManager", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test connection to storage service
   * Performs actual connection test by uploading and deleting a test file
   * @returns Result indicating test success or failure
   */
  async testConnection(): Promise<Result> {
    try {
      const uploader = this.getService();
      const result = await uploader.testConnection();

      if (result.success) {
        logger.debug("StorageServiceManager", "Connection test successful");
      } else {
        logger.error(
          "StorageServiceManager",
          "Connection test failed",
          result.error,
        );
      }

      return result;
    } catch (error) {
      const errorMessage = `Connection test failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error("StorageServiceManager", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Upload a file to storage service
   * Handles duplicate checking and progress reporting
   * @param file - File to upload
   * @param key - Storage key for the file
   * @param onProgress - Progress callback function
   * @returns Result with upload data or error information
   */
  async uploadFile(
    file: File,
    key: string,
    onProgress?: (progress: number) => void,
  ): Promise<Result<UploadData>> {
    const service = this.getService();

    // Check if file already exists and skip duplicates if configured
    if (this.configurationManager.isSkipDuplicateFiles()) {
      const result = await service.fileExistsByPrefix(key);
      if (result && result.success && result.data) {
        logger.debug(
          "StorageServiceManager",
          "uploadFile file exists, skipping",
        );
        if (onProgress) {
          onProgress(100);
        }
        return result;
      }
    }

    return await service.uploadFile(file, key, onProgress);
  }

  /**
   * Delete a file from storage service
   * @param key - Storage key of the file to delete
   * @returns Result indicating deletion success or failure
   */
  async deleteFile(key: string): Promise<Result> {
    try {
      const service = this.getService();
      return await service.deleteFile(key);
    } catch (error) {
      logger.error("StorageServiceManager", "File deletion error", {
        key,
        error,
      });
      return handleError(error, "error.fileDeletionFailed");
    }
  }

  /**
   * Download file from URL and save to vault
   * @param app - Obsidian App instance
   * @param url - URL to download from
   * @param currentFilePath - Current file path for attachment location
   * @param onProgress - Progress callback function
   * @returns Result with local path and file name
   */
  async downloadAndSaveFile(
    app: App,
    url: string,
    currentFilePath: string,
    onProgress?: (progress: number) => void,
  ): Promise<Result<{ localPath: string; fileName: string }>> {
    try {
      const decodedUrl = decodeURIComponent(url);
      const fileName = decodeURIComponent(
        decodedUrl.split("/").pop() || "file",
      );

      const currentServiceType =
        this.configurationManager.getCurrentStorageService();
      const requestOptions: RequestUrlParam = { url };

      if (currentServiceType === StorageServiceType.WEBDAV) {
        const config =
          this.configurationManager.getCurrentStorageConfig() as WebdavConfig;
        requestOptions.headers = {
          Authorization:
            "Basic " +
            btoa(`${config.access_key_id}:${config.secret_access_key}`),
        };
      }

      const response = await requestUrl(requestOptions);
      if (onProgress) {
        onProgress(100);
      }

      const firstUnderscoreIndex = fileName.indexOf("_");
      const secondUnderscoreIndex = fileName.indexOf(
        "_",
        firstUnderscoreIndex + 1,
      );
      const actualFileName =
        secondUnderscoreIndex > 0
          ? fileName.substring(secondUnderscoreIndex + 1)
          : fileName;
      const fullPath = normalizePath(
        await app.fileManager.getAvailablePathForAttachment(
          actualFileName,
          currentFilePath,
        ),
      );
      const created = await app.vault.createBinary(
        fullPath,
        response.arrayBuffer,
      );
      const localPath = created.path.replace(
        created.name,
        encodeURIComponent(created.name),
      );

      return { success: true, data: { localPath, fileName: actualFileName } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        "StorageServiceManager",
        `Download failed: ${errorMessage}`,
        { url },
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Dispose of all service instances
   * Called during plugin unload to clean up resources
   */
  dispose(): void {
    this.serviceInstances.forEach((service) => {
      if (service.dispose) {
        service.dispose();
      }
    });
    this.serviceInstances.clear();
  }
}
