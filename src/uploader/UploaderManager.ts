import { IUploader } from "../types";
import { UploaderTypeInfo } from "./UploaderRegistry";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { handleError } from "../utils/ErrorHandler";
import type { FileAutoUploadSettings, ConfigChangeListener } from "../types";
import { logger } from "../utils/Logger";

/**
 * Manages upload service instances and operations
 * Handles file uploads, deletions, and storage operations
 */
export class UploadServiceManager {
  private configurationManager: ConfigurationManager;
  private uploaderInstances: Map<string, IUploader> = new Map();

  constructor(configurationManager: ConfigurationManager) {
    this.configurationManager = configurationManager;
    this.initializeConfigChangeListener();
  }

  private initializeConfigChangeListener(): void {
    const configChangeListener: ConfigChangeListener = (
      changedSettings: Partial<FileAutoUploadSettings>,
    ) => {
      this.handleConfigChange(changedSettings);
    };

    this.configurationManager.addConfigChangeListener(configChangeListener);
  }

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

  getUploader(): IUploader {
    const serviceType = this.configurationManager.getCurrentStorageService();
    const cached = this.uploaderInstances.get(serviceType);
    if (cached) {
      return cached;
    }

    logger.debug("UploaderManager", "Creating new uploader instance", {
      serviceType,
    });

    const config = this.configurationManager.getCurrentStorageConfig();
    const uploaderInfo =
      UploaderTypeInfo[serviceType as keyof typeof UploaderTypeInfo];
    if (!uploaderInfo) {
      throw new Error(`Unknown uploader type: ${serviceType}`);
    }
    const uploader = new uploaderInfo.clazz(
      config as import("../types").S3Config,
    ) as IUploader;
    this.uploaderInstances.set(serviceType, uploader);
    return uploader;
  }

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

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<import("../types").UploadResult> {
    const uploader = this.getUploader();
    return await uploader.uploadFile(file, undefined, onProgress);
  }

  async deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const uploader = this.getUploader();
      return await uploader.deleteFile(key);
    } catch (error) {
      logger.error("UploaderManager", "File deletion error", { key, error });
      return handleError(error, "error.fileDeletionFailed");
    }
  }

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

  dispose(): void {
    this.uploaderInstances.forEach((uploader) => {
      if (uploader.dispose) {
        uploader.dispose();
      }
    });
    this.uploaderInstances.clear();
  }
}
