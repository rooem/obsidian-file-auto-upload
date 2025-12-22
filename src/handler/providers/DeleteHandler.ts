import { App, Notice } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { logger } from "../../common/Logger";
import { BaseEventHandler } from "./BaseHandler";
import { ProcessItem, DeleteProcessItem, EventType } from "../../types/index";
import { t } from "../../i18n";

/**
 * Handles file deletion operations from storage services
 */
export class DeleteEventHandler extends BaseEventHandler {
  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
  ) {
    super(app, configurationManager, storageServiceManager, 3);
  }

  public handleDeleteUploadedFiles(items: DeleteProcessItem[]): void {
    logger.debug("DeleteEventHandler", "Files queued for deletion", {
      itemsLength: items.length,
    });
    void this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    if (processItem.eventType !== EventType.DELETE) {
      return;
    }

    const item = processItem as DeleteProcessItem;
    const { fileLink, fileKey, originalSelection } = item;

    try {
      const result = await this.storageServiceManager.deleteFile(fileKey);
      if (result.success) {
        this.contentReplacer.removeContentByUrl(fileLink, originalSelection);
        logger.debug("DeleteEventHandler", "File deleted successfully", {
          fileKey,
        });
      } else {
        logger.error("DeleteEventHandler", "Delete operation failed", {
          fileKey,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("DeleteEventHandler", "Delete operation exception", {
        fileKey,
        error,
      });
    }
  }

  public async deleteFileFromEditor(
    fileLink: string,
    fileKey: string,
  ): Promise<boolean> {
    try {
      const result = await this.storageServiceManager.deleteFile(fileKey);
      if (result.success) {
        this.contentReplacer.removeContentByUrl(fileLink);
        return true;
      } else {
        new Notice(`${t("error.deleteFailed")}: ${result.error || ""}`);
        return false;
      }
    } catch (error) {
      new Notice(
        `${t("error.deleteError")}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
