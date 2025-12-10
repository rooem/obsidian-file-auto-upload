/**
 * WebDAV Uploader - Provides upload functionality for WebDAV servers.
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
import { requestUrl, RequestUrlParam } from "obsidian";

/** HTTP status codes for WebDAV operations */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
} as const;

export class WebdavUploader implements IUploader {
  private config: WebdavConfig;

  constructor(config: UploaderConfig) {
    this.config = config as WebdavConfig;
  }

  // ==================== Public API ====================

  public checkConnectionConfig(): Result {
    const requiredFields = [
      { key: "endpoint", error: t("error.missingEndpoint") },
      { key: "username", error: t("error.missingUsername") },
      { key: "password", error: t("error.missingPassword") },
    ];

    for (const field of requiredFields) {
      if (!this.config[field.key as keyof WebdavConfig]) {
        return { success: false, error: field.error };
      }
    }
    return { success: true };
  }

  public async testConnection(): Promise<Result> {
    const checkResult = this.checkConnectionConfig();
    if (!checkResult.success) return checkResult;

    try {
      const isAuthValid = await this.verifyAuthentication();
      if (!isAuthValid.success) return isAuthValid;

      return await this.performUploadTest();
    } catch (error) {
      return this.formatError(error);
    }
  }

  public async uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>> {
    try {
      const fileKey = key || generateFileKey(file.name);
      
      await this.ensureDirectoryExists(fileKey);
      
      const response = await this.request({
        url: this.buildUrl(fileKey),
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: await file.arrayBuffer(),
      });

      if (!this.isSuccessStatus(response.status)) {
        return { success: false, error: `${t("error.uploadFailed")}: HTTP ${response.status}` };
      }

      onProgress?.(100);
      
      const publicUrl = this.getPublicUrl(fileKey);
      logger.debug("WebdavUploader", "Upload successful", { fileName: file.name, url: publicUrl });

      return { success: true, data: { url: publicUrl, key: fileKey } };
    } catch (error) {
      logger.error("WebdavUploader", "Upload failed", { fileName: file.name, error });
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(key: string): Promise<Result> {
    try {
      const normalizedKey = this.normalizeKey(key);
      const url = this.buildUrl(normalizedKey);
      
      logger.debug("WebdavUploader", "Deleting file", { key: normalizedKey, url });

      const response = await this.request({ url, method: "DELETE" });

      if (response.status === HTTP_STATUS.NO_CONTENT || response.status === HTTP_STATUS.NOT_FOUND) {
        logger.debug("WebdavUploader", "Delete successful", { key: normalizedKey });
        return { success: true };
      }

      return { success: false, error: `${t("error.deleteFailed")}: HTTP ${response.status}` };
    } catch (error) {
      logger.error("WebdavUploader", "Delete error", { key, error });
      return handleError(error, "error.deleteError");
    }
  }

  public async fileExistsByPrefix(prefix: string): Promise<Result<UploadData>> {
    try {
      const response = await this.request({
        url: this.buildUrl(prefix),
        method: "HEAD",
      });

      if (response.status === HTTP_STATUS.OK) {
        return {
          success: true,
          data: { url: this.getPublicUrl(prefix), key: prefix },
        };
      }
      return { success: false };
    } catch (error) {
      logger.error("WebdavUploader", "Check file exists error", error);
      return handleError(error, "error.uploadError");
    }
  }

  public getPublicUrl(key: string): string {
    if (this.config.public_domain) {
      const domain = this.config.public_domain.replace(/\/+$/, "");
      return `${domain}/${this.buildPath(key)}`;
    }
    return this.buildAuthenticatedUrl(key);
  }

  public dispose(): void {
    logger.debug("WebdavUploader", "Disposed");
  }

  // ==================== Private Helpers ====================

  private async request(params: Omit<RequestUrlParam, "headers"> & { headers?: Record<string, string> }) {
    return requestUrl({
      ...params,
      headers: { Authorization: this.buildAuthHeader(), ...params.headers },
      throw: false,
    });
  }

  private async verifyAuthentication(): Promise<Result> {
    const response = await this.request({
      url: this.buildUrl("test-connection-check"),
      method: "HEAD",
    });

    if (response.status === HTTP_STATUS.NOT_FOUND || response.status === HTTP_STATUS.OK) {
      return { success: true };
    }
    return { success: false, error: `Server returned HTTP ${response.status}` };
  }

  private async performUploadTest(): Promise<Result> {
    const testFile = new File(
      [`WebDAV connection test - ${new Date().toISOString()}`],
      "test.txt",
      { type: "text/plain" }
    );

    const result = await this.uploadFile(testFile, "test/connection-test.txt");
    
    if (result.success && result.data?.key) {
      await this.deleteFile(result.data.key);
      return { success: true };
    }
    return { success: false, error: result.error || "Connection test failed" };
  }

  private async ensureDirectoryExists(key: string): Promise<void> {
    const parts = key.split("/").slice(0, -1);
    if (parts.length === 0) return;

    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      const response = await this.request({
        url: this.buildUrl(currentPath) + "/",
        method: "MKCOL",
      });

      if (response.status !== HTTP_STATUS.CREATED && response.status !== HTTP_STATUS.METHOD_NOT_ALLOWED) {
        logger.debug("WebdavUploader", "MKCOL response", { path: currentPath, status: response.status });
      }
    }
  }

  private buildAuthHeader(): string {
    return "Basic " + btoa(`${this.config.username}:${this.config.password}`);
  }

  private buildPath(key: string): string {
    const basePath = this.config.base_path?.replace(/^\/|\/$/g, "") || "";
    return basePath ? `${basePath}/${key}` : key;
  }

  private buildUrl(key: string): string {
    const endpoint = this.config.endpoint.replace(/\/+$/, "");
    return `${endpoint}/${this.buildPath(key)}`;
  }

  private buildAuthenticatedUrl(key: string): string {
    try {
      const url = new URL(this.config.endpoint);
      url.username = encodeURIComponent(this.config.username);
      url.password = encodeURIComponent(this.config.password);
      return `${url.origin}${url.pathname}/${this.buildPath(key)}`.replace(/([^:]\/)\/+/g, "$1");
    } catch {
      return `${this.config.endpoint}/${this.buildPath(key)}`;
    }
  }

  private normalizeKey(key: string): string {
    const basePath = this.config.base_path?.replace(/^\/|\/$/g, "") || "";
    return key.replace(basePath, "").replace(/^\//, "");
  }

  private isSuccessStatus(status: number): boolean {
    return status === HTTP_STATUS.OK || status === HTTP_STATUS.CREATED || status === HTTP_STATUS.NO_CONTENT;
  }

  private formatError(error: unknown): Result {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
