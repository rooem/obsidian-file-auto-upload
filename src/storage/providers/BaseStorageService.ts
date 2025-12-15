import { Result, UploadData, IStorageService, UploadProgressCallback } from "../../types";
import { logger } from "../../common/Logger";

export abstract class BaseStorageService implements IStorageService {
  protected abstract serviceName: string;

  abstract checkConnectionConfig(): Result;
  abstract uploadFile(file: File, key?: string, onProgress?: UploadProgressCallback): Promise<Result<UploadData>>;
  abstract deleteFile(key: string, sha?: string): Promise<Result>;
  abstract fileExistsByPrefix(key: string): Promise<Result<UploadData>>;
  abstract getPublicUrl(key: string): string;

  public async testConnection(): Promise<Result> {
    const checkResult = this.checkConnectionConfig();
    if (!checkResult.success) {
      return checkResult;
    }

    try {
      const testFile = new File([`Connection test - ${new Date().toISOString()}`], "test.txt", { type: "text/plain" });
      const result = await this.uploadFile(testFile, "test/connection-test.txt");

      if (result.success && result.data?.key) {
        await this.deleteFile(result.data.key, result.data.sha);
        return { success: true };
      }
      return { success: false, error: result.error || "Connection test failed" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public dispose(): void {
    logger.debug(this.serviceName, "Service disposed");
  }

  protected formatPublicUrl(key: string, publicDomain?: string, defaultUrl?: string): string {
    if (publicDomain) {
      return `${publicDomain.replace(/\/$/, "")}/${key}`;
    }
    return defaultUrl || key;
  }
}
