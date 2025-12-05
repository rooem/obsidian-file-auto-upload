import { App, MarkdownView, Editor, Notice, Menu, MenuItem } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { BaseEventHandler } from "./BaseEventHandler";
import { EventType, ProcessItem, DeleteItem } from "../types/index";
import { t } from "../i18n";
import { logger } from "../utils/Logger";

/**
 * Handles deletion of uploaded files from storage
 * Adds context menu option to delete files and removes links from editor
 */
export class DeleteEventHandler extends BaseEventHandler<DeleteItem> {
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
   * Add delete option to editor context menu for uploaded files
   * @param menu - Context menu
   * @param editor - Editor instance
   * @param view - Markdown view instance
   */
  public handleEditorContextMenu(
    menu: Menu,
    editor: Editor,
    view: MarkdownView,
  ): void {
    const selectedText = editor.getSelection();
    if (!selectedText) {
      return;
    }

    const uploadedFileLinks = this.extractUploadedFileLinks(selectedText);
    if (!uploadedFileLinks || uploadedFileLinks.length === 0) {
      return;
    }

    menu.addItem((item: MenuItem) => {
      item
        .setTitle(t("delete.menuTitle"))
        .setIcon("trash")
        .setWarning(true)
        .onClick(() => {
          void this.handleDeleteUploadedFiles(
            uploadedFileLinks,
            editor,
            view,
          );
        });
    });
  }

  /**
 * Handle deletion of multiple uploaded files
 * @param fileLinks - Array of file URLs to delete
 * @param editor - Editor instance
 * @param view - Markdown view instance
 */
  public handleDeleteUploadedFiles(
    fileLinks: string[],
    editor: Editor,
    _view: MarkdownView,
  ): void {
    if (fileLinks.length === 0) {
      return;
    }

    logger.debug("DeleteEventHandler", "Delete operation initiated", {
      fileCount: fileLinks.length,
    });

    const result = this.uploadServiceManager.checkConnectionConfig();
    if (!result.success) {
      logger.warn(
        "DeleteEventHandler",
        "Connection config invalid, showing config modal",
      );
      this.configurationManager.showStorageConfigModal();
      return;
    }

    const originalSelection = editor.getSelection();
    if (!originalSelection) {
      logger.warn("DeleteEventHandler", "No text selected");
      return;
    }

    const queue: ProcessItem<DeleteItem>[] = fileLinks.map((link) => ({
      id: `d${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`,
      eventType: EventType.DELETE,
      type: "delete",
      value: {
        fileLink: link,
        fileKey: this.extractFileKeyFromUrl(link),
        originalSelection: originalSelection,
      },
    }));

    logger.debug("DeleteEventHandler", "Files queued for deletion", {
      queueLength: queue.length,
    });
    void this.processItems(queue);
  }

  /**
   * Process file deletion from storage and remove from editor
   * @param item - Delete item containing file information
   */
  protected async processItem(item: ProcessItem<DeleteItem>): Promise<void> {
    if (item.eventType !== EventType.DELETE) {
      return;
    }

    const { fileLink, fileKey, originalSelection } = item.value;

    logger.debug("DeleteEventHandler", "Processing delete item", {
      fileLink,
      fileKey,
    });

    try {
      const result = await this.uploadServiceManager.deleteFile(fileKey);

      if (result.success) {
        logger.debug(
          "DeleteEventHandler",
          "File deleted and link removed from editor",
          { fileLink },
        );
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
        
        // 使用函数替换来处理包含括号的链接
        let updatedText = this.removeMarkdownLinks(textToProcess, fileLink);
        // 移除独立的 URL
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
   * Extract storage key from file URL
   * @param url - File URL
   * @returns Storage key for deletion
   */
  private extractFileKeyFromUrl(url: string): string {
    try {
      const publicDomain = this.configurationManager.getPublicDomain();

      let extractedKey: string;

      if (url.startsWith(publicDomain)) {
        const baseUrl = publicDomain.replace(/\/$/, "");
        extractedKey = url.substring(baseUrl.length + 1);
      } else {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        extractedKey = pathname.startsWith("/")
          ? pathname.substring(1)
          : pathname;
      }

      // Encode the key to match the storage format
      // Split by '/' and encode each part separately to preserve the path structure
      const keyParts = extractedKey.split("/");
      const encodedKeyParts = keyParts.map((part) => {
        // Decode first in case it's already encoded, then re-encode to ensure consistency
        try {
          const decoded = decodeURIComponent(part);
          return encodeURIComponent(decoded);
        } catch {
          // If decoding fails, just encode the original part
          return encodeURIComponent(part);
        }
      });

      return encodedKeyParts.join("/");
    } catch (error) {
      logger.error("DeleteEventHandler", "File key extraction failed", error);
      return url;
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
    let result = '';
    let i = 0;
    
    while (i < text.length) {
      const startIdx = i;
      // 检查 ! 前缀
      if (text[i] === '!' && i + 1 < text.length && text[i + 1] === '[') {
        i++;
      }
      
      if (text[i] === '[') {
        // 找到匹配的 ]
        let bracketDepth = 1;
        let j = i + 1;
        while (j < text.length && bracketDepth > 0) {
          if (text[j] === '[') bracketDepth++;
          else if (text[j] === ']') bracketDepth--;
          j++;
        }
        
        if (bracketDepth === 0 && j < text.length && text[j] === '(') {
          // 找到匹配的右括号
          let parenDepth = 1;
          let k = j + 1;
          while (k < text.length && parenDepth > 0) {
            if (text[k] === '(') parenDepth++;
            else if (text[k] === ')') parenDepth--;
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
