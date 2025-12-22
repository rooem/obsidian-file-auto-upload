import { App, TFile } from "obsidian";
import { BaseEventHandler } from "./BaseHandler";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { logger } from "../../common/Logger";
import { ProcessItem, DownloadProcessItem, EventType } from "../../types/index";
import { t } from "../../i18n";

/**
 * Handles batch file download operations for folders
 */
export class FolderDownloadHandler extends BaseEventHandler {
  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
  ) {
    super(app, configurationManager, storageServiceManager, 3);
  }

  protected async processItem(_processItem: ProcessItem): Promise<void> {
    // Not used directly - download logic is in handleDownloadFiles
  }

  /**
   * Download files to local vault
   */
  public async handleDownloadFiles(
    items: DownloadProcessItem[],
    onProgress: (current: number, total: number, filename: string) => void,
  ): Promise<void> {
    let downloadedCount = 0;
    const totalCount = items.length;

    for (const item of items) {
      if (item.eventType !== EventType.DOWNLOAD) {
        continue;
      }

      try {
        downloadedCount++;
        onProgress(
          downloadedCount,
          totalCount,
          decodeURIComponent(item.url.split("/").pop() || "file"),
        );

        await this.concurrencyController.run(async () => {
          const result = await this.storageServiceManager.downloadAndSaveFile(
            this.app,
            item.url,
            "", // Current file path - empty for downloads
          );

          if (!result.success) {
            logger.error("FolderDownloadHandler", "Download failed", {
              url: item.url,
              error: result.error,
            });
          }
        });
      } catch (error) {
        logger.error("FolderDownloadHandler", "Download error", {
          url: item.url,
          error,
        });
      }
    }
  }
}
