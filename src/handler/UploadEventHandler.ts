import { App, MarkdownView } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { StatusBar } from "../components/StatusBar";
import { logger } from "../utils/Logger";
import { ProcessItem, TextProcessItem, FileProcessItem } from "../types/index";
import {
  isFileTypeSupported,
  isImageExtension,
  generateFileKey
} from "../utils/FileUtils";

import { t } from "../i18n";

/**
 * Handles file upload operations with progress tracking
 */
export class UploadEventHandler extends BaseEventHandler {
  protected uploadServiceManager: UploadServiceManager;
  private statusBarManager: StatusBar;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
    statusBarManager: StatusBar,
  ) {
    super(app, configurationManager, 3);
    this.uploadServiceManager = uploadServiceManager;
    this.statusBarManager = statusBarManager;
  }

  public async handleFileUploadEvent(items: ProcessItem[]): Promise<void> {
    logger.debug("UploadEventHandler", "Files queued for upload", {
      itemsLength: items.length,
    });

    for (const processItem of items) {
      if (processItem.type === "file") {
        if (processItem.localPath) {
          await this.replaceLocalLinkWithPlaceholder(processItem);
        } else {
          await this.insertPlaceholder(processItem);
        }
      }
    }

    void this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        logger.warn("UploadEventHandler", "No active markdown view");
        return;
      }

      if (processItem.type === "text") {
        activeView.editor.replaceSelection(
          (processItem as TextProcessItem).value,
        );
      } else if (processItem.type === "file") {
        await this.processFileItem(processItem);
      }
    } catch (error) {
      logger.error("UploadEventHandler", "Error processing item", error);
    }
  }

  private insertPlaceholder(processItem: FileProcessItem): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const placeholderText = `[${processItem.value.name}]${this.getPlaceholderSuffix(processItem)}\n`;
    editor.replaceSelection(placeholderText);
  }

  private replaceLocalLinkWithPlaceholder(processItem: FileProcessItem): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !processItem.localPath) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const escapedPath = processItem.localPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const linkRegex = new RegExp(`(!?\\[[^\\]]*\\])\\(${escapedPath}\\)`, "g");
    const placeholder = `$1${this.getPlaceholderSuffix(processItem)}`;
    const newContent = content.replace(linkRegex, placeholder);

    if (newContent !== content) {
      editor.setValue(newContent);
    }
  }

  private getPlaceholderSuffix(processItem: FileProcessItem): string {
    return `⏳${t("upload.progressing")}<!--${processItem.id}-->`;
  }

  private async processFileItem(processItem: FileProcessItem): Promise<void> {
    const file = processItem.value;
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();

    if (!isFileTypeSupported(supportedTypes, processItem.extension)) {
      await this.saveToVault(processItem);
      return;
    }

    this.statusBarManager.startUpload(processItem.id);

    try {
      const key = generateFileKey(file.name, processItem.id);
      const result = await this.uploadServiceManager.uploadFile(
        file,
        key,
        (progress) => {
          this.statusBarManager.updateProgress(processItem.id, progress);
        },
      );

      if (result.success && result.url) {
        const markdown = isImageExtension(processItem.extension)
          ? `![${file.name}](${encodeURI(result.url)})`
          : `[${file.name}](${encodeURI(result.url)})`;
        await this.replacePlaceholder(processItem.id, markdown);
      } else {
        await this.replacePlaceholder(
          processItem.id,
          `[${file.name}]❌${result.error || t("error.uploadFailed")}`,
        );
      }
    } finally {
      this.statusBarManager.finishUpload(processItem.id);
    }
  }

  private replacePlaceholder(id: string, text: string): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${id}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      const lastLine = editor.lastLine();
      editor.replaceRange(text + "\n", { line: lastLine + 1, ch: 0 });
      return;
    }

    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    if (linkStartIndex === -1) {
      const lastLine = editor.lastLine();
      editor.replaceRange(text + "\n", { line: lastLine + 1, ch: 0 });
      return;
    }

    const startPos = editor.offsetToPos(linkStartIndex);
    const endPos = editor.offsetToPos(markerIndex + marker.length);
    editor.replaceRange(text, startPos, endPos);
  }

  private async saveToVault(processItem: FileProcessItem): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.file) {
      return;
    }

    const file = processItem.value;
    try {
      const fullPath = await this.app.fileManager.getAvailablePathForAttachment(
        file.name,
        activeView.file.path,
      );
      const created = await this.app.vault.createBinary(
        fullPath,
        await file.arrayBuffer(),
      );

      const markdown = isImageExtension(processItem.extension)
        ? `![${file.name}](${created.path})`
        : `[${file.name}](${created.path})`;
      await this.replacePlaceholder(processItem.id, markdown);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.replacePlaceholder(
        processItem.id,
        `[${file.name}]❌${errorMsg}`,
      );
    }
  }
}
