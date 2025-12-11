import { App, MarkdownView, normalizePath } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { StatusBar } from "../components/StatusBar";
import { logger } from "../utils/Logger";
import {
  ProcessItem,
  TextProcessItem,
  FileProcessItem,
  EventType,
} from "../types/index";
import {
  isFileTypeSupported,
  isImageExtension,
  generateFileKey,
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

  public handleFileUploadEvent(items: ProcessItem[]): void {
    logger.debug("UploadEventHandler", "Files queued for upload", {
      itemsLength: items.length,
    });

    for (const processItem of items) {
      if (processItem.type === "file") {
        if (processItem.localPath) {
          this.replaceLocalLinkWithPlaceholder(processItem);
        } else {
          this.insertPlaceholder(processItem);
        }
      }
    }

    void this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    if (processItem.eventType !== EventType.UPLOAD) {
      return;
    }

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
    if (!processItem.localPath) {
      return;
    }
    this.replaceUrlWithPlaceholder(
      processItem.localPath,
      this.getPlaceholderSuffix(processItem),
    );
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

      if (result.success && result.data) {
        const markdown = isImageExtension(processItem.extension)
          ? `![${file.name}](${encodeURI(result.data.url)})`
          : `[${file.name}](${encodeURI(result.data.url)})`;
        this.replacePlaceholder(processItem.id, markdown);

        // Delete local file if setting is enabled
        if (
          processItem.localPath &&
          this.configurationManager.isDeleteAfterUpload()
        ) {
          try {
            const decodedPath = decodeURIComponent(processItem.localPath);
            const normalizedPath = normalizePath(decodedPath);         
            await this.app.vault.adapter.remove(normalizedPath);
          } catch (e) {
            logger.warn("UploadEventHandler", "Failed to delete local file", {
              path: processItem.localPath,
              error: e,
            });
          }
        }
      } else {
        this.replacePlaceholder(
          processItem.id,
          `[${file.name}]❌${result.error || t("error.uploadFailed")}`,
        );
      }
    } finally {
      this.statusBarManager.finishUpload(processItem.id);
    }
  }

  private replacePlaceholder(id: string, text: string): void {
    this.replacePlaceholderWithMarkdown(id, text);
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
      this.replacePlaceholder(processItem.id, markdown);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.replacePlaceholder(processItem.id, `[${file.name}]❌${errorMsg}`);
    }
  }
}
