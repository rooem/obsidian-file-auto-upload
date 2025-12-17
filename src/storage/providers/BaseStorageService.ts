import { Result, UploadData, IStorageService, UploadProgressCallback } from "../../types";
import { logger } from "../../common/Logger";
import { requestUrl, RequestUrlParam } from "obsidian";

export abstract class BaseStorageService implements IStorageService {
  protected abstract serviceName: string;

  abstract checkConnectionConfig(): Result;
  abstract uploadFile(file: File, key?: string, onProgress?: UploadProgressCallback): Promise<Result<UploadData>>;
  abstract deleteFile(key: string, sha?: string): Promise<Result>;
  abstract fileExistsByPrefix(key: string): Promise<Result<UploadData>>;
  abstract getPublicUrl(key: string): string;

  protected getDownloadHeaders(): Record<string, string> | undefined {
    return undefined;
  }

  public async downloadFile(
    url: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<ArrayBuffer>> {
    const progressInterval = onProgress ? this.simulateProgress(100000, onProgress) : null;
    try {
      const requestOptions: RequestUrlParam = { url };
      const headers = this.getDownloadHeaders();
      if (headers) {
        requestOptions.headers = headers;
      }
      const response = await requestUrl(requestOptions);
      if (progressInterval) clearInterval(progressInterval);
      onProgress?.(100);
      return { success: true, data: response.arrayBuffer };
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(this.serviceName, `Download failed: ${errorMessage}`, { url });
      return { success: false, error: errorMessage };
    }
  }

  public async testConnection(): Promise<Result> {
    const checkResult = this.checkConnectionConfig();
    if (!checkResult.success) {
      return checkResult;
    }

    try {
      const testFile = new File([`Connection test - ${new Date().toISOString()}`], "test.txt", { type: "text/plain" });
      const result = await this.uploadFile(testFile, "test/connection-test.txt");

      if (!result.success || !result.data?.key) {
        return { success: false, error: result.error || "Upload test failed" };
      }

      const publicUrl = this.getPublicUrl(result.data.key);
      try {
        const response = await requestUrl({ url: publicUrl });
        if (response.status < 200 || response.status >= 300) {
          await this.deleteFile(result.data.key, result.data.sha);
          return { success: false, error: `Public domain access failed: HTTP ${response.status}` };
        }
      } catch (error) {
        await this.deleteFile(result.data.key, result.data.sha);
        return { success: false, error: `Public domain access failed: ${error instanceof Error ? error.message : String(error)}` };
      }

      await this.deleteFile(result.data.key, result.data.sha);
      return { success: true };
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

  /**
   * Simulate progress based on file size and estimated network speed
   * Uses exponential slowdown to simulate realistic network behavior
   */
  protected simulateProgress(
    fileSize: number,
    onProgress: UploadProgressCallback,
  ): ReturnType<typeof setInterval> {
    let progress = 0;
    const startTime = Date.now();
    // Estimate: ~500KB/s for small files, slower for larger files
    const estimatedDuration = Math.max(500, Math.min(fileSize / 500, 10000));

    return setInterval(() => {
      const elapsed = Date.now() - startTime;
      // Use logarithmic curve for more realistic progress simulation
      // Fast at start, slows down as it approaches completion
      const targetProgress = Math.min(95, (Math.log(elapsed + 100) / Math.log(estimatedDuration + 100)) * 95);

      // Smooth transition: move 20% of the remaining distance each tick
      progress = progress + (targetProgress - progress) * 0.2;
      onProgress(Math.round(progress));
    }, 200);
  }
}
