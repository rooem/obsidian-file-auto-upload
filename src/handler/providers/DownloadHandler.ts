import { MarkdownView, Notice, App } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { StatusBar } from "../../components/StatusBar";
import { t } from "../../i18n";
import { logger } from "../../common/Logger";
import { ProcessItem, DownloadProcessItem, EventType } from "../../types/index";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";

export class DownloadHandler extends BaseEventHandler {
  private statusBar: StatusBar;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
    statusBar: StatusBar,
  ) {
    super(app, configurationManager, storageServiceManager, 3);
    this.statusBar = statusBar;
  }

  public handleDownloadFiles(items: DownloadProcessItem[]): void {
    this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    if (processItem.eventType !== EventType.DOWNLOAD) {
      return;
    }

    const item = processItem as DownloadProcessItem;
    const url = item.url;
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView?.file) {
        return;
      }

      this.statusBar.startDownload(item.id);
      this.replaceUrlWithDownloading(url, item.id);

      const result = await this.storageServiceManager.downloadAndSaveFile(
        this.app,
        url,
        activeView.file.path,
        (progress) => this.statusBar.updateProgress(item.id, progress),
      );

      if (result.success && result.data) {
        this.replacePlaceholder(
          item.id,
          result.data.localPath,
          result.data.fileName,
        );
        new Notice(
          t("download.success").replace("{fileName}", result.data.fileName),
        );
      } else {
        new Notice(
          t("download.failed").replace(
            "{error}",
            result.error || "Unknown error",
          ),
        );
        logger.error("DownloadHandler", "Download failed", {
          url,
          error: result.error,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(t("download.failed").replace("{error}", errorMsg));
      logger.error("DownloadHandler", "Download failed", { url, error });
    } finally {
      this.statusBar.finishDownload(item.id);
    }
  }

  private replaceUrlWithDownloading(url: string, id: string): void {
    this.replaceUrlWithPlaceholder(
      url,
      this.getPlaceholderSuffix(id, t("download.progressing")),
    );
  }

  private replacePlaceholder(
    id: string,
    localPath: string,
    fileName: string,
  ): void {
    const markdown = `[${fileName}](${localPath})`;
    this.replacePlaceholderWithMarkdown(id, markdown, fileName);
  }
}
