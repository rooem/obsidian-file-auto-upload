import { IUploader } from "../types";
import { UploaderType } from "../uploader/UploaderType";
import { UploaderTypeInfo } from "../uploader/UploaderRegistry";
import { ConfigurationManager } from "./ConfigurationManager";
import { handleError } from "../utils/ErrorHandler";
import type { FileAutoUploadSettings, ConfigChangeListener } from "../types";
import { logger } from "../utils/Logger";

/**
 * Manages upload service instances and operations
 * Handles file uploads, deletions, and storage operations
 */
export class UploadServiceManager {
  private configurationManager: ConfigurationManager;
  private uploaderInstances: Map<UploaderType, IUploader> = new Map();

  constructor(configurationManager: ConfigurationManager) {
    this.configurationManager = configurationManager;
    this.initializeConfigChangeListener();
  }

  /**
   * Listen for configuration changes to clear uploader cache
   */
  private initializeConfigChangeListener(): void {
    const configChangeListener: ConfigChangeListener = (
      changedSettings: Partial<FileAutoUploadSettings>,
    ) => {
      this.handleConfigChange(changedSettings);
    };

    this.configurationManager.addConfigChangeListener(configChangeListener);
  }

  /**
   * Clear uploader instances when configuration changes
   */
  private handleConfigChange(
    _changedSettings: Partial<FileAutoUploadSettings>,
  ): void {
    // Dispose of existing uploader instances before clearing
    this.uploaderInstances.forEach((uploader) => {
      if (uploader.dispose) {
        uploader.dispose();
      }
    });
    this.uploaderInstances.clear();
    logger.debug(
      "UploaderManager",
      "All uploader instance caches cleared, will be recreated on next use",
    );
  }

  /**
   * Get or create uploader instance for current storage service
   * @returns Uploader instance
   */
  getUploader(): IUploader {
    const serviceType = this.configurationManager.getCurrentStorageService();
    const cached = this.uploaderInstances.get(serviceType);
    if (cached) {
      logger.debug("UploaderManager", "Using cached uploader instance", {
        serviceType,
      });
      return cached;
    }

    logger.debug("UploaderManager", "Creating new uploader instance", {
      serviceType,
    });

    const config = this.configurationManager.getCurrentStorageConfig();

    const clazz = UploaderTypeInfo[serviceType].clazz;
    const uploader = new clazz(
      config as import("../types").S3Config,
    ) as IUploader;
    this.uploaderInstances.set(serviceType, uploader);

    logger.debug("UploaderManager", "Uploader instance created", {
      serviceType,
    });
    return uploader;
  }

  /**
   * Check if storage connection configuration is valid
   * @returns Result with success status and optional error
   */
  checkConnectionConfig(): { success: boolean; error?: string } {
    try {
      const uploader = this.getUploader();
      const result = uploader.checkConnectionConfig();

      if (result.success) {
        logger.debug("UploaderManager", "Check Connection config successful");
      } else {
        logger.error(
          "UploaderManager",
          "Check Connection config failed",
          result.error,
        );
      }

      return result;
    } catch (error) {
      const errorMessage = `Check Connection config error: ${error instanceof Error ? error.message : String(error)}`;
      logger.error("UploaderManager", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test connection to storage service
   * @returns Result with success status and optional error
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const uploader = this.getUploader();
      const result = await uploader.testConnection();

      if (result.success) {
        logger.debug("UploaderManager", "Connection test successful");
      } else {
        logger.error("UploaderManager", "Connection test failed", result.error);
      }

      return result;
    } catch (error) {
      const errorMessage = `Connection test failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error("UploaderManager", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Upload a single file to storage
   * @param file - File to upload
   * @param key - Optional storage key
   * @param onProgress - Optional progress callback
   * @returns Upload result with URL
   */
  async uploadFile(
    file: File,
    key?: string,
    onProgress?: (progress: number) => void,
  ): Promise<import("../types").UploadResult> {
    logger.debug("UploaderManager", "Starting file upload", {
      fileName: file.name,
      fileSize: file.size,
      key,
    });

    const uploader = this.getUploader();
    const result = await uploader.uploadFile(file, key, onProgress);

    if (result.success) {
      logger.debug("UploaderManager", "File upload successful", {
        fileName: file.name,
        url: result.url,
      });
    } else {
      logger.error("UploaderManager", "File upload failed", {
        fileName: file.name,
        error: result.error,
      });
    }

    return result;
  }

  /**
   * Delete a file from storage
   * @param key - Storage key of file to delete
   * @returns Result with success status and optional error
   */
  async deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
    logger.debug("UploaderManager", "Starting file deletion", { key });

    try {
      const uploader = this.getUploader();
      const result = await uploader.deleteFile(key);

      if (result.success) {
        logger.debug("UploaderManager", "File deletion successful", { key });
      } else {
        logger.error("UploaderManager", "File deletion failed", {
          key,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error("UploaderManager", "File deletion error", { key, error });
      return handleError(error, "error.fileDeletionFailed");
    }
  }

  /**
   * Check if a file exists in storage
   * @param key - Storage key to check
   * @returns Result with exists status and optional error
   */
  async fileExists(key: string): Promise<{ exists: boolean; error?: string }> {
    try {
      const uploader = this.getUploader();
      const result = await uploader.fileExists(key);
      return {
        exists: result.exists,
        error: result.error,
      };
    } catch (error) {
      return {
        exists: false,
        ...handleError(error, "error.fileExistenceCheckFailed"),
      };
    }
  }

  /**
   * Get file information from storage
   * @param key - Storage key
   * @returns Result with file info and optional error
   */
  async getFileInfo(key: string): Promise<{
    success: boolean;
    info?: import("../types").FileInfo;
    error?: string;
  }> {
    try {
      const uploader = this.getUploader();
      return await uploader.getFileInfo(key);
    } catch (error) {
      return handleError(error, "error.getFileInfoFailed");
    }
  }

  /**
   * Dispose all uploader instances
   */
  dispose(): void {
    this.uploaderInstances.forEach((uploader) => {
      if (uploader.dispose) {
        uploader.dispose();
      }
    });
    this.uploaderInstances.clear();
  }
}
