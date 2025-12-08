import { MarkdownView, Notice, requestUrl, App } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { StatusBar } from "../components/StatusBar";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { isImageExtension } from "../utils/FileUtils";
import { ProcessItem, DownloadProcessItem, EventType } from "../types/index";
import { ConfigurationManager } from "../settings/ConfigurationManager";

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

      const response = await requestUrl({ url });
      this.statusBar.updateProgress(item.id, 100);

      const randomStringIndex = fileName.indexOf("_");
      const actualFileName = randomStringIndex > 0 ? fileName.substring(randomStringIndex + 1) : fileName;
      const fullPath = await this.app.fileManager.getAvailablePathForAttachment(
        actualFileName,
        activeView.file.path,
      );
      await this.app.vault.createBinary(fullPath, response.arrayBuffer);
   
      // Use actual saved file name from fullPath (may have number suffix if duplicate)
      const savedFileName = fullPath.split("/").pop() || actualFileName;
      await this.replacePlaceholder(item.id, fullPath, decodeURIComponent(savedFileName));

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
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`(!?\\[[^\\]]*\\])\\(${escapedUrl}\\)`, "g");
    const placeholder = `$1⏳${t("download.progressing")}<!--${id}-->`;
    const newContent = content.replace(linkRegex, placeholder);

    if (newContent !== content) {
      editor.setValue(newContent);
    }
  }

  private replacePlaceholder(
    id: string,
    localPath: string,
    fileName: string,
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const localMarkdown = `[${fileName}](${localPath})`;

    const marker = `<!--${id}-->`;
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) {
      return;
    }

    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    if (linkStartIndex === -1) {
      return;
    }

    // Check if there's already an image prefix (!)
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const hasImagePrefix = linkStartIndex > 0 && content[linkStartIndex - 1] === "!";
    const needsImagePrefix = isImageExtension(extension) && !hasImagePrefix;
    const finalMarkdown = needsImagePrefix ? `!${localMarkdown}` : localMarkdown;

    const startPos = editor.offsetToPos(linkStartIndex);
    const endPos = editor.offsetToPos(markerIndex + marker.length);
    editor.replaceRange(finalMarkdown, startPos, endPos);
  }
}
