import { requestUrl, Notice } from "obsidian";
import { Result, UploadData, UploadProgressCallback, StorageServiceConfig, GithubConfig } from "../../types";
import { t } from "../../i18n";
import { handleError } from "../../common/ErrorHandler";
import { logger } from "../../common/Logger";
import { generateFileKey } from "../../common/FileUtils";
import { Constants } from "../../common/Constants";
import { BaseStorageService } from "./BaseStorageService";
import { GITHUB_CDN_OPTIONS } from "../../settings/StorageServiceSettings";

const GITHUB_API_BASE = "https://api.github.com";
const HTTP_STATUS = Constants.HTTP_STATUS;

interface GithubContentResponse {
  sha?: string;
  content?: { sha?: string };
}

export class GithubStorageService extends BaseStorageService {
  protected serviceName = "GithubStorageService";
  private config: GithubConfig;
  private branch: string;
  private basePath: string;

  constructor(config: StorageServiceConfig) {
    super();
    this.config = config as GithubConfig;
    this.branch = this.config.branch || "main";
    this.basePath = this.config.path?.replace(/^\/|\/$/g, "") || "";
  }

  private get apiBase(): string {
    return `${GITHUB_API_BASE}/repos/${this.config.bucket_name}/contents`;
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.config.secret_access_key}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    };
  }

  private getFilePath(key: string): string {
    return this.basePath ? `${this.basePath}/${key}` : key;
  }

  public checkConnectionConfig(): Result {
    if (!this.config.secret_access_key) {
      return { success: false, error: t("error.missingAccessKeyId") };
    }
    if (!this.config.bucket_name) {
      return { success: false, error: t("error.missingBucketName") };
    }
    if (!this.config.bucket_name.includes("/")) {
      return { success: false, error: "Invalid repo format. Use: owner/repo" };
    }
    return { success: true };
  }

  public async uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>> {
    const progressInterval = onProgress ? this.simulateProgress(file.size, onProgress) : null;
    try {
      const fileKey = key || generateFileKey(file.name);
      const filePath = this.getFilePath(fileKey);
      const existingSha = await this.getFileSha(filePath);

      const response = await requestUrl({
        url: `${this.apiBase}/${filePath}`,
        method: "PUT",
        headers: this.headers as Record<string, string>,
        body: JSON.stringify({
          message: `Upload ${fileKey}`,
          content: this.arrayBufferToBase64(await file.arrayBuffer()),
          branch: this.branch,
          ...(existingSha && { sha: existingSha }),
        }),
        throw: false,
      });

      if (progressInterval) clearInterval(progressInterval);

      // GitHub API returns 200 (update) or 201 (create) on success
      if (response.status !== HTTP_STATUS.OK && response.status !== HTTP_STATUS.CREATED) {
        // If upload failed due to conflict (409/422), try to get existing file URL
        if (response.status === 409 || response.status === 422) {
          const sha = await this.getFileSha(filePath);
          if (sha) {
            const publicUrl = this.getPublicUrl(filePath);
            logger.debug("GithubStorageService", "File conflict, returning existing URL", { fileName: file.name, url: publicUrl });
            return { success: true, data: { url: publicUrl, key: filePath, sha } };
          }
        }
        logger.error("GithubStorageService", "Upload failed", { fileName: file.name, status: response.status, text: response.text });
        return { success: false, error: `Upload failed (${response.status}): ${response.text}` };
      }

      onProgress?.(100);
      const res = response.json as GithubContentResponse;
      const publicUrl = this.getPublicUrl(filePath);
      logger.debug("GithubStorageService", "Upload successful", { fileName: file.name, url: publicUrl });

      return { success: true, data: { url: publicUrl, key: filePath, sha: res.content?.sha } };
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      logger.error("GithubStorageService", "Upload failed", { fileName: file.name, error });
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(key: string, providedSha?: string): Promise<Result> {
    try {
      key = decodeURIComponent(key);
      // Remove CDN URL prefixes based on GITHUB_CDN_OPTIONS configuration
      for (const template of Object.values(GITHUB_CDN_OPTIONS)) {
        const prefix = template
          .replace("{repo}", this.config.bucket_name)
          .replace("{branch}", this.branch)
          .replace(/^https?:\/\/[^/]+\//, ""); // Remove domain, keep path
        if (key.startsWith(prefix + "/")) {
          key = key.substring(prefix.length + 1);
          break;
        }
      }
      
      const sha = providedSha || (await this.getFileSha(key));
      if (!sha) {
        logger.debug("GithubStorageService", "Delete File not found", { key });
        new Notice(t("delete.fileNotFound").replace("{key}", key));
        return { success: true };
      }

      const response = await requestUrl({
        url: `${this.apiBase}/${key}`,
        method: "DELETE",
        headers: this.headers as Record<string, string>,
        body: JSON.stringify({ message: `Delete ${key}`, sha, branch: this.branch }),
        throw: false,
      });

      if (response.status < HTTP_STATUS.NOT_FOUND) {
        logger.debug("GithubStorageService", "Delete successful", { key });
        return { success: true };
      }
      return { success: false, error: `Delete failed: ${response.text}` };
    } catch (error) {
      logger.error("GithubStorageService", "Delete error", { key, error });
      return handleError(error, "error.deleteError");
    }
  }

  public async fileExistsByPrefix(key: string): Promise<Result<UploadData>> {
    try {
      const filePath = this.getFilePath(key);
      const sha = await this.getFileSha(filePath);
      if (sha) {
        return { success: true, data: { url: this.getPublicUrl(filePath), key: filePath } };
      }
      return { success: false };
    } catch (error) {
      logger.error("GithubStorageService", "Check file exists error", error);
      return handleError(error, "error.uploadError");
    }
  }

  public getPublicUrl(key: string): string {
    // Use CDN if enabled
    if (this.config.use_cdn) {
      const cdnType = this.config.cdn_type || "jsdelivr";
      const template = GITHUB_CDN_OPTIONS[cdnType];
      if (template) {
        const baseUrl = template
          .replace("{repo}", this.config.bucket_name)
          .replace("{branch}", this.branch);
        return `${baseUrl}/${key}`;
      }
    }

    const domain = this.config.public_domain?.replace(/\/$/, "");
    if (domain) {
      return `${domain}/${key}`;
    }
    // Use GitHub raw URL by default (immediately available, no CDN cache delay)
    return `https://raw.githubusercontent.com/${this.config.bucket_name}/${this.branch}/${key}`;
  }

  private async getFileSha(path: string): Promise<string | null> {
    try {
      const response = await requestUrl({
        url: `${this.apiBase}/${path}?ref=${this.branch}`,
        headers: this.headers as Record<string, string>,
        throw: false,
      });
      if (response.status < HTTP_STATUS.NOT_FOUND) {
        return (response.json as GithubContentResponse).sha || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunks.join(""));
  }

}
