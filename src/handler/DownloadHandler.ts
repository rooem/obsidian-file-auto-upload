import { MarkdownView, Notice, requestUrl } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { StatusBar } from "../components/StatusBar";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { isImageExtension } from "../utils/FileUtils";
import { ProcessItem, DownloadProcessItem } from "../types/index";

export class DownloadHandler extends BaseEventHandler {
  private statusBar: StatusBar;

  constructor(
    app: import("obsidian").App,
    configurationManager: import("../settings/ConfigurationManager").ConfigurationManager,
    statusBar: StatusBar,
  ) {
    super(app, configurationManager, 3);
    this.statusBar = statusBar;
  }

  public handleDownloadFiles(items: DownloadProcessItem[]): void {
    this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    if (processItem.type !== "download") {
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

      const response = await requestUrl({ url });
      this.statusBar.updateProgress(item.id, 100);

      const randomStringIndex = fileName.indexOf("_");
      const actualFileName = randomStringIndex > 0 ? fileName.substring(randomStringIndex + 1) : fileName;
      const fullPath = await this.app.fileManager.getAvailablePathForAttachment(
        actualFileName,
        activeView.file.path,
      );
      await this.app.vault.createBinary(fullPath, response.arrayBuffer);

      await this.replaceUrlWithLocalPath(url, fullPath, actualFileName);

      new Notice(t("download.success").replace("{fileName}", actualFileName));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(t("download.failed").replace("{error}", errorMsg));
      logger.error("DownloadHandler", "Download failed", { url, error });
    } finally {
      this.statusBar.finishDownload(item.id);
    }
  }

  private replaceUrlWithLocalPath(
    url: string,
    localPath: string,
    fileName: string,
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const prefix = isImageExtension(extension) ? "!" : "";
    const localMarkdown = `${prefix}[${fileName}](${localPath})`;

    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`!?\\[[^\\]]*\\]\\(${escapedUrl}\\)`, "g");
    const newContent = content.replace(linkRegex, localMarkdown);

    if (newContent !== content) {
      editor.setValue(newContent);
    }
  }
}
