import { requestUrl } from "obsidian";
import { Result, UploadData, UploadProgressCallback, StorageServiceConfig, GithubConfig } from "../../types";
import { t } from "../../i18n";
import { handleError } from "../../common/ErrorHandler";
import { logger } from "../../common/Logger";
import { generateFileKey } from "../../common/FileUtils";
import { BaseStorageService } from "./BaseStorageService";

const GITHUB_API_BASE = "https://api.github.com";

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

      if (response.status >= 400) {
        return { success: false, error: `Upload failed: ${response.text}` };
      }

      const res = response.json as GithubContentResponse;
      onProgress?.(100);
      const publicUrl = this.getPublicUrl(filePath);
      logger.debug("GithubStorageService", "Upload successful", { fileName: file.name, url: publicUrl });

      return { success: true, data: { url: publicUrl, key: filePath, sha: res.content?.sha } };
    } catch (error) {
      logger.error("GithubStorageService", "Upload failed", { fileName: file.name, error });
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(key: string, providedSha?: string): Promise<Result> {
    try {
      key = decodeURIComponent(key)
        .replace(new RegExp(`^/?gh/${this.config.bucket_name}@${this.branch}/`), "")
        .replace(new RegExp(`^https://raw\\.githubusercontent\\.com/${this.config.bucket_name}/${this.branch}/`), "");
      const sha = providedSha || (await this.getFileSha(key));
      if (!sha) return { success: false, error: "File not found" };

      const response = await requestUrl({
        url: `${this.apiBase}/${key}`,
        method: "DELETE",
        headers: this.headers as Record<string, string>,
        body: JSON.stringify({ message: `Delete ${key}`, sha, branch: this.branch }),
        throw: false,
      });

      if (response.status < 400) {
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
    const domain = this.config.public_domain?.replace(/\/$/, "");
    if (domain?.includes("cdn.jsdelivr.net") || domain?.includes("cdn.statically.io")) {
      return `${domain}/gh/${this.config.bucket_name}@${this.branch}/${key}`;
    }
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
      if (response.status < 400) {
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
