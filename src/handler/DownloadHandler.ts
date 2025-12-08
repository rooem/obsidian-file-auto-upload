import { App, MarkdownView, Notice, requestUrl } from "obsidian";
import { StatusBar } from "../components/StatusBar";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { generateUniqueId, isImageExtension } from "../utils/FileUtils";

export class DownloadHandler {
  constructor(
    private app: App,
    private statusBar: StatusBar,
  ) {}

  async downloadFiles(urls: string[]): Promise<void> {
    for (const url of urls) {
      await this.downloadFile(url);
    }
  }

  private async downloadFile(url: string): Promise<void> {
    const id = generateUniqueId("dl");
    const decodedUrl = decodeURIComponent(url);
    const fileName = decodedUrl.split("/").pop() || "file";

    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView?.file) {
        return;
      }

      this.statusBar.startDownload(id);

      const response = await requestUrl({ url });
      this.statusBar.updateProgress(id, 100);

       // Replace remote URL with local path in the document
      const decodedFileName = decodeURIComponent(fileName);
      const fullPath = await this.app.fileManager.getAvailablePathForAttachment(
        decodedFileName,
        activeView.file.path,
      );
      await this.app.vault.createBinary(fullPath, response.arrayBuffer);

      await this.replaceUrlWithLocalPath(url, fullPath, fileName);

      new Notice(t("download.success").replace("{fileName}", fileName));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(t("download.failed").replace("{error}", errorMsg));
      logger.error("DownloadHandler", "Download failed", { url, error });
    } finally {
      this.statusBar.finishDownload(id);
    }
  }

  private async replaceUrlWithLocalPath(
    url: string,
    localPath: string,
    fileName: string,
  ): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.file) {
      return;
    }

    const file = activeView.file;
    const content = await this.app.vault.cachedRead(file);
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const prefix = isImageExtension(extension) ? "!" : "";
    const localMarkdown = `${prefix}[${fileName}](${localPath})`;

    // Replace the URL in markdown links
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`!?\\[[^\\]]*\\]\\(${escapedUrl}\\)`, "g");
    const newContent = content.replace(linkRegex, localMarkdown);

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }
}
