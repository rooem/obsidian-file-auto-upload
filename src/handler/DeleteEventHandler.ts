import { App, MarkdownView, Notice } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { BaseEventHandler } from "./BaseEventHandler";
import { EventType, ProcessItem, DeleteProcessItem } from "../types/index";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { removeMarkdownLinksByUrl } from "../utils/FileUtils";

/**
 * Handles deletion of uploaded files from storage
 * Adds context menu option to delete files and removes links from editor
 */
export class DeleteEventHandler extends BaseEventHandler {
  protected uploadServiceManager: UploadServiceManager;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
  ) {
    super(app, configurationManager);
    this.uploadServiceManager = uploadServiceManager;
  }

  public handleDeleteUploadedFiles(items: ProcessItem[]): void {
    logger.debug("DeleteEventHandler", "Files queued for deletion", {
      queueLength: items.length,
    });
    void this.processItems(items);
  }

  protected async processItem(item: DeleteProcessItem): Promise<void> {
    if (item.eventType !== EventType.DELETE) {
      return;
    }

    const { fileLink, fileKey, originalSelection } = item;

    try {
      const result = await this.uploadServiceManager.deleteFile(fileKey);

      if (result.success) {
        new Notice(t("delete.success").replace("{fileLink}", fileLink));
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView?.editor) {
          logger.warn("DeleteEventHandler", "No active editor found");
          return;
        }

        const editor = activeView.editor;
        const currentSelection = editor.getSelection();
        const textToProcess = currentSelection || originalSelection;

        let updatedText = removeMarkdownLinksByUrl(textToProcess, fileLink);
        const urlRegex = new RegExp(super.escapeRegExp(fileLink), "g");
        updatedText = updatedText.replace(urlRegex, "");
        updatedText = updatedText.replace(/\n\s*\n\s*/g, "\n\n").trim();

        const fromCursor = editor.getCursor("from");
        const toCursor = editor.getCursor("to");

        editor.replaceRange(updatedText, fromCursor, toCursor);
      } else {
        logger.error("DeleteEventHandler", "Delete operation failed", {
          fileLink,
          error: result.error,
        });
        new Notice(
          t("delete.failed")
            .replace("{fileLink}", fileLink)
            .replace("{error}", result.error || t("delete.unknownError")),
        );
      }
    } catch (error) {
      logger.error(
        "DeleteEventHandler",
        "Error occurred while deleting file",
        error,
      );
      new Notice(t("delete.error").replace("{fileLink}", fileLink));
    }
  }
}
