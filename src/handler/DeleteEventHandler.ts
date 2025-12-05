import { App, MarkdownView, Notice } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { BaseEventHandler } from "./BaseEventHandler";
import { EventType, ProcessItem, DeleteProcessItem } from "../types/index";
import { t } from "../i18n";
import { logger } from "../utils/Logger";

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

  /**
   * Handle deletion of multiple uploaded files
   * @param fileLinks - Array of file URLs to delete
   * @param editor - Editor instance
   * @param view - Markdown view instance
   */
  public handleDeleteUploadedFiles(items: ProcessItem[]): void {
    logger.debug("DeleteEventHandler", "Files queued for deletion", {
      queueLength: items.length,
    });
    void this.processItems(items);
  }

  /**
   * Process file deletion from storage and remove from editor
   * @param item - Delete item containing file information
   */
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

        const escapedUrl = this.escapeRegExp(fileLink);

        let updatedText = this.removeMarkdownLinks(textToProcess, fileLink);
        const urlRegex = new RegExp(escapedUrl, "g");
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

  /**
   * Escape special regex characters in string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Remove markdown links containing the specified URL
   */
  private removeMarkdownLinks(text: string, targetUrl: string): string {
    let result = "";
    let i = 0;

    while (i < text.length) {
      const startIdx = i;
      // 检查 ! 前缀
      if (text[i] === "!" && i + 1 < text.length && text[i + 1] === "[") {
        i++;
      }

      if (text[i] === "[") {
        // 找到匹配的 ]
        let bracketDepth = 1;
        let j = i + 1;
        while (j < text.length && bracketDepth > 0) {
          if (text[j] === "[") {
            bracketDepth++;
          } else if (text[j] === "]") {
            bracketDepth--;
          }
          j++;
        }

        if (bracketDepth === 0 && j < text.length && text[j] === "(") {
          // 找到匹配的右括号
          let parenDepth = 1;
          let k = j + 1;
          while (k < text.length && parenDepth > 0) {
            if (text[k] === "(") {
              parenDepth++;
            } else if (text[k] === ")") {
              parenDepth--;
            }
            k++;
          }
          if (parenDepth === 0) {
            const url = text.substring(j + 1, k - 1);
            if (url === targetUrl) {
              // 跳过这个链接
              i = k;
              continue;
            }
          }
        }
      }

      result += text[startIdx];
      i = startIdx + 1;
    }

    return result;
  }
}
