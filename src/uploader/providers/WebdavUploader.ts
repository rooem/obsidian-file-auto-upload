/**
 * WebDAV Uploader
 *
 * Provides upload functionality for WebDAV servers.
 *
 * @implements {IUploader}
 */

import {
  Result,
  UploadData,
  IUploader,
  UploadProgressCallback,
  UploaderConfig,
  WebdavConfig,
} from "../../types";
import { t } from "../../i18n";
import { handleError } from "../../utils/ErrorHandler";
import { logger } from "../../utils/Logger";
import { generateFileKey } from "../../utils/FileUtils";
import { requestUrl } from "obsidian";

export class WebdavUploader implements IUploader {
  private config: WebdavConfig;

  constructor(config: UploaderConfig) {
    this.config = config as WebdavConfig;
  }

  public checkConnectionConfig(): Result {
    if (!this.config.endpoint) {
      return { success: false, error: t("error.missingEndpoint") };
    }
    if (!this.config.username) {
      return { success: false, error: t("error.missingUsername") };
    }
    if (!this.config.password) {
      return { success: false, error: t("error.missingPassword") };
    }
    return { success: true };
  }

  public async testConnection(): Promise<Result> {
    const checkResult = this.checkConnectionConfig();
    if (!checkResult.success) {
      return checkResult;
    }

    try {
      // First test with a simple HEAD request to check authentication
      const testUrl = this.getFullUrl("test-connection-check");
      const headResponse = await requestUrl({
        url: testUrl,
        method: "HEAD",
        headers: {
          Authorization: this.getAuthHeader(),
        },
        throw: false,
      });

      // If we get 404, that means authentication works but file doesn't exist
      if (headResponse.status === 404 || headResponse.status === 200) {
        // Now try to upload a test file
        const testContent = `WebDAV connection test - ${new Date().toISOString()}`;
        const testFile = new File([testContent], "test.txt", {
          type: "text/plain",
        });

        const result = await this.uploadFile(testFile, "test/connection-test.txt");

        if (result.success && result.data?.key) {
          await this.deleteFile(result.data.key);
          return { success: true };
        }
        return { success: false, error: result.error || "Connection test failed" };
      }
      return { success: false, error: `Server returned HTTP ${headResponse.status} during connection test` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>> {
    try {
      const fileKey = key || generateFileKey(file.name);
      const url = this.getFullUrl(fileKey);

      // Ensure parent directories exist
      await this.ensureDirectoryExists(fileKey);

      const arrayBuffer = await file.arrayBuffer();

      const response = await requestUrl({
        url: url,
        method: "PUT",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": file.type || "application/octet-stream",
        },
        body: arrayBuffer,
        throw: false,
      });

      if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
        return {
          success: false,
          error: `${t("error.uploadFailed")}: HTTP ${response.status}`,
        };
      }

      if (onProgress) {
        onProgress(100);
      }

      const publicUrl = this.getPublicUrl(fileKey);
      logger.debug("WebdavUploader", "Upload successful", {
        fileName: file.name,
        url: publicUrl,
      });

      return {
        success: true,
        data: { url: publicUrl, key: fileKey },
      };
    } catch (error) {
      logger.error("WebdavUploader", "Upload failed", { fileName: file.name, error });
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(key: string): Promise<Result> {
    try {
      const basePath = this.config.base_path?.replace(/^\/|\/$/g, "") || "";
      key = key.replace(basePath, "");
      const url = this.getFullUrl(key);
      logger.debug("WebdavUploader", "Attempting to delete file", { key, url });

      const response = await requestUrl({
        url: url,
        method: "DELETE",
        headers: {
          Authorization: this.getAuthHeader(),
        },
        throw: false,
      });

      logger.debug("WebdavUploader", "Delete response", {
        key,
        status: response.status,
        headers: response.headers
      });

      if (response.status === 204 || response.status === 404) {
        logger.debug("WebdavUploader", "Delete successful", { key });
        return { success: true };
      }

      return {
        success: false,
        error: `${t("error.deleteFailed")}: HTTP ${response.status}`,
      };
    } catch (error) {
      logger.error("WebdavUploader", "Delete error", { key, error });
      return handleError(error, "error.deleteError");
    }
  }

  public async fileExistsByPrefix(prefix: string): Promise<Result<UploadData>> {
    try {
      // Use HEAD request to check if the exact file exists
      const url = this.getFullUrl(prefix);
      const response = await requestUrl({
        url: url,
        method: "HEAD",
        headers: {
          Authorization: this.getAuthHeader(),
        },
        throw: false,
      });

      // If we get 200, the file exists
      if (response.status === 200) {
        return {
          success: true,
          data: {
            url: this.getPublicUrl(prefix),
            key: prefix,
          },
        };
      }

      return { success: false };
    } catch (error) {
      logger.error("WebdavUploader", "Check file exists by prefix error", error);
      return handleError(error, "error.uploadError");
    }
  }

  public getPublicUrl(key: string): string {
    return this.getFullUrl(key);
  }

  public dispose(): void {
    logger.debug("WebdavUploader", "Disposed");
  }

  private async ensureDirectoryExists(key: string): Promise<void> {
    const parts = key.split("/");
    if (parts.length <= 1) return;

    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const url = this.getFullUrl(currentPath);

      try {
        const response = await requestUrl({
          url: url + "/",
          method: "MKCOL",
          headers: {
            Authorization: this.getAuthHeader(),
          },
          throw: false,
        });

        // Log directory creation result for debugging
        if (response.status !== 201 && response.status !== 405) {
          // 405 might mean directory already exists
          logger.debug("WebdavUploader", "MKCOL response", {
            path: url,
            status: response.status,
          });
        }
      } catch {
        // Directory may already exist, ignore errors
      }
    }
  }

  private getAuthHeader(): string {
    // Don't encode the credentials for Basic auth
    const credentials = `${this.config.username}:${this.config.password}`;
    return "Basic " + btoa(credentials);
  }

  private getFullPath(key: string): string {
    const basePath = this.config.base_path?.replace(/^\/|\/$/g, "") || "";
    return basePath ? `${basePath}/${key}` : key;
  }

  private getFullUrl(key: string): string {
    const endpoint = this.config.endpoint.replace(/\/+$/, "");
    return `${endpoint}/${this.getFullPath(key)}`;
  }
}
