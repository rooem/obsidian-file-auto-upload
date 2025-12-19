import { App, TFile, Notice } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { logger } from "../../common/Logger";
import { BaseEventHandler } from "./BaseHandler";
import { ProcessItem } from "../../types/index";
import { t } from "../../i18n";

/**
 * Handles batch file download operations for folders
 */
export class FolderDownloadHandler extends BaseEventHandler {
  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
    maxConcurrent: number = 3,
  ) {
    super(app, configurationManager, storageServiceManager, maxConcurrent);
  }

  protected async processItem(_processItem: ProcessItem): Promise<void> {
    // Not used directly - download logic is in handleDownloadFiles
  }

  /**
   * Download files from URLs
   * Process files with concurrency control
   * @returns Map of url -> local file path for successful downloads
   */
  public async handleDownloadFiles(
    urls: string[],
    onProgress: (current: number, total: number) => void
  ): Promise<Map<string, string>> {
    let downloadedCount = 0;
    const totalFiles = urls.length;
    const results: { url: string; success: boolean; fileName?: string; error?: string }[] = [];

    // Get active file for relative path resolution
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice(t("download.failed").replace("{error}", "No active file"));
      return new Map<string, string>();
    }

    // Process downloads with concurrency control
    const downloadPromises = urls.map((url) =>
      this.concurrencyController.run(async () => {
        try {
          const result = await this.storageServiceManager.downloadAndSaveFile(
            this.app,
            url,
            activeFile.path,
            () => {} // No individual progress tracking for batch downloads
          );

          downloadedCount++;
          onProgress(downloadedCount, totalFiles);

          if (result.success && result.data) {
            results.push({
              url,
              success: true,
              fileName: result.data.fileName,
            });
          } else {
            results.push({
              url,
              success: false,
              error: result.error || "Unknown error",
            });
            logger.error("FolderDownloadHandler", "Download failed", {
              url,
              error: result.error,
            });
          }
        } catch (error) {
          downloadedCount++;
          onProgress(downloadedCount, totalFiles);
          
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.push({
            url,
            success: false,
            error: errorMsg,
          });
          logger.error("FolderDownloadHandler", "Download failed", { url, error });
        }
      })
    );

    await Promise.all(downloadPromises);

    // Show summary
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (failCount === 0) {
      new Notice(
        t("download.success").replace("{fileName}", `${successCount} files`),
        3000
      );
    } else {
      new Notice(
        `${t("download.success").replace("{fileName}", `${successCount} files`)}\n${failCount} ${t("download.failed").replace("{error}", "files failed")}`,
        5000
      );
    }

    // Return url -> local path mapping
    const urlToLocalPath = new Map<string, string>();
    for (const r of results) {
      if (r.success && r.fileName) {
        urlToLocalPath.set(r.url, r.fileName);
      }
    }
    return urlToLocalPath;
  }
}
