import { App } from "obsidian";
import { BaseEventHandler } from "./BaseHandler";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { logger } from "../../common/Logger";
import { ProcessItem, DownloadProcessItem, EventType } from "../../types/index";
import { t } from "../../i18n";

/**
 * Handles file download operations from storage services to local vault
 */
export class DownloadHandler extends BaseEventHandler {
  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
  ) {
    super(app, configurationManager, storageServiceManager, 3);
  }

  public handleDownloadFiles(items: DownloadProcessItem[]): void {
    void this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    if (processItem.eventType !== EventType.DOWNLOAD) {
      return;
    }

    const item = processItem as DownloadProcessItem;
    const { url } = item;

    try {
      this.contentReplacer.replaceUrlWithPlaceholder(
        url,
        item.id,
        t("download.progressing"),
      );

      // We don't have the file size here, so we'll use 0 as a placeholder
      // In a real implementation, we'd want to get the file size first
      // this.statusBarManager?.startDownload(item.id, fileSize);

      const result = await this.storageServiceManager.downloadAndSaveFile(
        this.app,
        url,
        "", // Current file path - empty for downloads
        (loadedBytes) => {
          // Update progress with loaded bytes
          // this.statusBarManager?.updateProgress(item.id, loadedBytes);
        },
      );

      if (result.success && result.data) {
        const { localPath, fileName } = result.data;
        const markdown = `[${fileName}](${encodeURI(localPath)})`;
        this.contentReplacer.replacePlaceholderWithMarkdown(item.id, markdown, {
          contentType: "file",
          fileName,
        });
      } else {
        this.contentReplacer.replacePlaceholderWithMarkdown(
          item.id,
          `❌${result.error || t("error.downloadFailed")}`,
        );
      }
    } catch (error) {
      logger.error("DownloadHandler", "Download failed", { url, error });
      this.contentReplacer.replacePlaceholderWithMarkdown(
        item.id,
        `❌${t("error.downloadError")}`,
      );
    } finally {
      // this.statusBarManager?.finishDownload(item.id);
    }
  }
}