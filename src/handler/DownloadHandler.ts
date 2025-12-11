import { MarkdownView, Notice, requestUrl, App, normalizePath } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { StatusBar } from "../components/StatusBar";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { ProcessItem, DownloadProcessItem, EventType } from "../types/index";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploaderType } from "../uploader/UploaderRegistry";

export class DownloadHandler extends BaseEventHandler {
  private statusBar: StatusBar;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    statusBar: StatusBar,
  ) {
    super(app, configurationManager, 3);
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
    const decodedUrl = decodeURIComponent(url);
    const fileName = decodeURIComponent(decodedUrl.split("/").pop() || "file");
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView?.file) {
        return;
      }

      this.statusBar.startDownload(item.id);

      // 替换URL为下载中状态
      this.replaceUrlWithDownloading(url, item.id);

      // 检查是否是WebDAV服务，如果是则需要添加认证头
      let requestOptions: any = { url };
      const currentServiceType = this.configurationManager.getCurrentStorageService();
      
      if (currentServiceType === UploaderType.WEBDAV) {
        const config = this.configurationManager.getCurrentStorageConfig();
        const credentials = `${config.username}:${config.password}`;
        const authHeader = "Basic " + btoa(credentials);
        requestOptions = {
          url,
          headers: {
            Authorization: authHeader,
          },
        };
      }

      const response = await requestUrl(requestOptions);
      this.statusBar.updateProgress(item.id, 100);

      const firstUnderscoreIndex = fileName.indexOf("_");
      const secondUnderscoreIndex = fileName.indexOf('_', firstUnderscoreIndex + 1);
      const actualFileName = secondUnderscoreIndex > 0 ? fileName.substring(secondUnderscoreIndex + 1) : fileName;
      const fullPath = normalizePath(
        await this.app.fileManager.getAvailablePathForAttachment(
          actualFileName,
          activeView.file.path,
        )
      );
      const created = await this.app.vault.createBinary(fullPath, response.arrayBuffer);
      const localPath = created.path.replace(created.name, encodeURIComponent(created.name));

      this.replacePlaceholder(item.id, localPath, actualFileName);

      new Notice(t("download.success").replace("{fileName}", actualFileName));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(t("download.failed").replace("{error}", errorMsg));
      logger.error("DownloadHandler", "Download failed", { url, error });
    } finally {
      this.statusBar.finishDownload(item.id);
    }
  }

  private replaceUrlWithDownloading(url: string, id: string): void {
    this.replaceUrlWithPlaceholder(url, `⏳${t("download.progressing")}<!--${id}-->`);
  }

  private replacePlaceholder(id: string, localPath: string, fileName: string): void {
    const markdown = `[${fileName}](${localPath})`;
    this.replacePlaceholderWithMarkdown(id, markdown, fileName);
  }
}
