import { Result, UploadData, UploadProgressCallback, StorageServiceConfig, WebdavConfig } from "../../types";
import { t } from "../../i18n";
import { handleError } from "../../common/ErrorHandler";
import { logger } from "../../common/Logger";
import { generateFileKey } from "../../common/FileUtils";
import { LruCache } from "../../common/LruCache";
import { requestUrl, RequestUrlParam } from "obsidian";
import { BaseStorageService } from "./BaseStorageService";

const HTTP_STATUS = { OK: 200, CREATED: 201, NO_CONTENT: 204, NOT_FOUND: 404, METHOD_NOT_ALLOWED: 405 } as const;

export class WebdavStorageService extends BaseStorageService {
  protected serviceName = "WebdavStorageService";
  private config: WebdavConfig;
  // 1000 entries max, 10 minutes TTL per entry
  private prefixCache = new LruCache<string>(1000, 10 * 60 * 1000);

  constructor(config: StorageServiceConfig) {
    super();
    this.config = config as WebdavConfig;
  }

  // ==================== Public API ====================

  public checkConnectionConfig(): Result {
    const requiredFields = [
      { key: "endpoint", error: t("error.missingEndpoint") },
      { key: "access_key_id", error: t("error.missingUsername") },
      { key: "secret_access_key", error: t("error.missingPassword") },
    ];

    for (const field of requiredFields) {
      if (!this.config[field.key as keyof WebdavConfig]) {
        return { success: false, error: field.error };
      }
    }
    return { success: true };
  }

  public override async testConnection(): Promise<Result> {
    const checkResult = this.checkConnectionConfig();
    if (!checkResult.success) return checkResult;

    const isAuthValid = await this.verifyAuthentication();
    if (!isAuthValid.success) return isAuthValid;

    return super.testConnection();
  }

  public async uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>> {
    try {
      const fileKey = key || generateFileKey(file.name);

      await this.ensureDirectoryExists(fileKey);

      // Simulate upload progress
      const progressInterval = onProgress
        ? this.simulateProgress(file.size, onProgress)
        : null;

      const response = await this.request({
        url: this.buildUrl(fileKey),
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: await file.arrayBuffer(),
      });

      if (progressInterval) {
        clearInterval(progressInterval);
      }
      onProgress?.(100);

      if (!this.isSuccessStatus(response.status)) {
        return {
          success: false,
          error: `${t("error.uploadFailed")}: HTTP ${response.status}`,
        };
      }

      const publicUrl = this.getPublicUrl(fileKey);
      logger.debug("WebdavUploader", "Upload successful", {
        fileName: file.name,
        url: publicUrl,
      });

      return { success: true, data: { url: publicUrl, key: fileKey } };
    } catch (error) {
      logger.error("WebdavUploader", "Upload failed", {
        fileName: file.name,
        error,
      });
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(key: string): Promise<Result> {
    try {
      const normalizedKey = this.normalizeKey(key);
      const url = this.buildUrl(normalizedKey);

      logger.debug("WebdavUploader", "Deleting file", {
        key: normalizedKey,
        url,
      });

      const response = await this.request({ url, method: "DELETE" });

      if (
        response.status === HTTP_STATUS.NO_CONTENT ||
        response.status === HTTP_STATUS.NOT_FOUND
      ) {
        const pre = normalizedKey.substring(0, normalizedKey.indexOf("_"));
        this.prefixCache.delete(pre);
        logger.debug("WebdavUploader", "Delete successful", {
          key: normalizedKey,
        });
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

  public async fileExistsByPrefix(key: string): Promise<Result<UploadData>> {
    try {
      const prefix = key?.substring(0, key.indexOf("_"));
      if (!prefix) {
        return { success: false };
      }

      const fileKey = this.prefixCache.get(prefix);
      if (fileKey) {
        return {
          success: true,
          data: { url: this.getPublicUrl(fileKey), key: key },
        };
      }

      const response = await this.request({
        url: this.buildUrl(""),
        method: "PROPFIND",
        headers: { Depth: "1" },
      });

      if (response.status === HTTP_STATUS.OK || response.status === 207) {
        logger.debug("WebdavUploader", "PROPFIND response", {
          status: response.status,
          textLength: response.text?.length,
          textPreview: response.text?.substring(0, 500),
        });

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response.text, "text/xml");

        // Try different namespace prefixes
        let hrefs = xmlDoc.getElementsByTagName("d:href");
        if (hrefs.length === 0) {
          hrefs = xmlDoc.getElementsByTagName("D:href");
        }
        if (hrefs.length === 0) {
          hrefs = xmlDoc.getElementsByTagName("href");
        }

        logger.debug("WebdavUploader", "Found hrefs", { count: hrefs.length });

        for (let i = 0; i < hrefs.length; i++) {
          const href = decodeURIComponent(hrefs[i].textContent || "");
          const fileName = href.substring(href.lastIndexOf("/") + 1);
          const pre = fileName.substring(0, fileName.indexOf("_"));
          if (!pre) {
            continue;
          }

          this.prefixCache.set(pre, fileName);
          if (prefix === pre) {
            return {
              success: true,
              data: { url: this.getPublicUrl(fileName), key: fileName },
            };
          }
        }
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
    return this.buildUrl(key);
  }

  public override dispose(): void {
    this.prefixCache.clear();
    super.dispose();
  }

  protected override getDownloadHeaders(): Record<string, string> {
    return { Authorization: this.buildAuthHeader() };
  }

  // ==================== Private Helpers ====================

  private async request(
    params: Omit<RequestUrlParam, "headers"> & {
      headers?: Record<string, string>;
    },
  ) {
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

    if (
      response.status === HTTP_STATUS.NOT_FOUND ||
      response.status === HTTP_STATUS.OK
    ) {
      return { success: true };
    }
    return { success: false, error: `Server returned HTTP ${response.status}` };
  }

  private async ensureDirectoryExists(key: string): Promise<void> {
    const parts = key.split("/").slice(0, -1);
    if (parts.length === 0) {
      return;
    }

    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const response = await this.request({
        url: this.buildUrl(currentPath) + "/",
        method: "MKCOL",
      });

      if (
        response.status !== HTTP_STATUS.CREATED &&
        response.status !== HTTP_STATUS.METHOD_NOT_ALLOWED
      ) {
        logger.debug("WebdavUploader", "MKCOL response", {
          path: currentPath,
          status: response.status,
        });
      }
    }
  }

  private buildAuthHeader(): string {
    return (
      "Basic " +
      btoa(`${this.config.access_key_id}:${this.config.secret_access_key}`)
    );
  }

  private buildPath(key: string): string {
    const basePath = (this.config.bucket_name || "").replace(/^\/|\/$/g, "");
    return basePath ? `${basePath}/${key}` : key;
  }

  private buildUrl(key: string): string {
    const endpoint = this.config.endpoint.replace(/\/+$/, "");
    return `${endpoint}/${this.buildPath(key)}`;
  }

  private normalizeKey(key: string): string {
    const basePath = (this.config.bucket_name || "").replace(/^\/|\/$/g, "");
    return key.replace(basePath, "").replace(/^\//, "");
  }

  private isSuccessStatus(status: number): boolean {
    return (
      status === HTTP_STATUS.OK ||
      status === HTTP_STATUS.CREATED ||
      status === HTTP_STATUS.NO_CONTENT
    );
  }

  private formatError(error: unknown): Result {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
