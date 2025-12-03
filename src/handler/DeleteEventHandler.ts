import { App, MarkdownView, Editor, Notice, Menu, MenuItem } from "obsidian";
import { ConfigurationManager } from "../manager/ConfigurationManager";
import { UploadServiceManager } from "../manager/UploaderManager";
import { BaseEventHandler } from "./BaseEventHandler";
import { t } from "../i18n";
import { logger } from "../utils/Logger";

interface DeleteItem {
  fileLink: string;
  fileKey: string;
  editor: Editor;
  originalSelection: string;
}

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
   * Process file deletion from storage and remove from editor
   * @param item - Delete item containing file information
   * @param index - The index of the item in the original queue
   */
  protected async processItem(item: {
    type: string;
    value: DeleteItem;
  }): Promise<void> {
    if (item.type !== "delete") {
      return;
    }

    const { fileLink, fileKey, editor, originalSelection } = item.value;

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

        const currentSelection = editor.getSelection();
        const textToProcess = currentSelection || originalSelection;

        const escapedUrl = this.escapeRegExp(fileLink);
        const linkRegex = new RegExp(`!?\\[[^\\]]*\\]\\(${escapedUrl}\\)`, "g");
        const urlRegex = new RegExp(escapedUrl, "g");

        let updatedText = textToProcess.replace(linkRegex, "");
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

    const queue = fileLinks.map((link) => ({
      type: "delete",
      value: {
        fileLink: link,
        fileKey: this.extractFileKeyFromUrl(link),
        editor: editor,
        originalSelection: originalSelection,
      },
    }));

    logger.debug("DeleteEventHandler", "Files queued for deletion", {
      queueLength: queue.length,
    });
    void this.addToProcessingQueue(queue);
  }

  /**
   * Extract storage key from file URL
   * @param url - File URL
   * @returns Storage key for deletion
   */
  private extractFileKeyFromUrl(url: string): string {
    try {
      const settings = this.configurationManager.getSettings();
      const publicUrl = settings.uploaderConfig.public_domain;

      let extractedKey: string;

      if (publicUrl && typeof publicUrl === "string") {
        new URL(publicUrl);
        if (url.startsWith(publicUrl)) {
          const baseUrl = publicUrl.replace(/\/$/, "");
          extractedKey = url.substring(baseUrl.length + 1);
        } else {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          extractedKey = pathname.startsWith("/")
            ? pathname.substring(1)
            : pathname;
        }
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
}
