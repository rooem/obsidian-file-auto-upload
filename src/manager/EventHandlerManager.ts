import { App, Notice, MarkdownView, Menu, Editor } from "obsidian";
import { ConfigurationManager } from "./ConfigurationManager";
import { UploadServiceManager } from "./UploaderManager";
import { UploadEventHandler } from "../handler/UploadEventHandler";
import { DeleteEventHandler } from "../handler/DeleteEventHandler";
import { t } from "../i18n";
import { logger } from "../utils/Logger";

export class EventHandlerManager {
  private configurationManager: ConfigurationManager;
  private uploadServiceManager: UploadServiceManager;
  private uploadEventHandler: UploadEventHandler;
  private deleteEventHandler: DeleteEventHandler;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
  ) {
    this.configurationManager = configurationManager;
    this.uploadServiceManager = uploadServiceManager;
    this.uploadEventHandler = new UploadEventHandler(
      app,
      configurationManager,
      uploadServiceManager,
    );

    this.deleteEventHandler = new DeleteEventHandler(
      app,
      configurationManager,
      uploadServiceManager,
    );
  }

  public handleClipboardPaste(
    evt: ClipboardEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): void {
    const settings = this.configurationManager.getSettings();
    if (!settings.clipboardAutoUpload || !evt.clipboardData) {
      return;
    }

    if (this.canHandle(evt, evt.clipboardData.items)) {
      void this.uploadEventHandler.handleFileUploadEvent(
        evt.clipboardData.items,
      );
    }
  }

  public handleFileDrop(
    evt: DragEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): void {
    const settings = this.configurationManager.getSettings();
    if (!settings.dragAutoUpload || !evt.dataTransfer) {
      return;
    }

    if (this.canHandle(evt, evt.dataTransfer.items)) {
      void this.uploadEventHandler.handleFileUploadEvent(
        evt.dataTransfer.items,
      );
    }
  }

  public handleEditorContextMenu(
    menu: Menu,
    editor: Editor,
    view: MarkdownView,
  ): void {
    void this.deleteEventHandler.handleEditorContextMenu(menu, editor, view);
  }

  private canHandle(evt: Event, items: DataTransferItemList): boolean {
    if (items && items.length === 0) {
      return false;
    }

    logger.debug("EventHandlerManager", "File upload event triggered", {
      itemCount: items.length,
    });

    evt.preventDefault();

    const result = this.uploadServiceManager.checkConnectionConfig();
    if (!result.success) {
      logger.warn(
        "EventHandlerManager",
        "Connection config invalid, showing config modal",
      );
      this.configurationManager.showStorageConfigModal();
      return false;
    }

    return true;
  }

  public dispose(): void {
    const handlers = [this.uploadEventHandler, this.deleteEventHandler];
    const statuses = handlers.map((handler) => handler.getQueueStatus());

    const totalQueueLength = statuses.reduce(
      (sum, status) => sum + status.queueLength,
      0,
    );
    const isProcessing = statuses.some((status) => status.isProcessing);

    if (totalQueueLength > 0 || isProcessing) {
      new Notice(
        t("notice.queueLost").replace("{count}", totalQueueLength.toString()),
        3000,
      );
    }

    handlers.forEach((handler) => handler.clearQueue());
  }
}
