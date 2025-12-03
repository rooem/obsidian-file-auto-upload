import { App, Notice, MarkdownView, Menu, MenuItem, Editor } from "obsidian";
import { ConfigurationManager } from "./ConfigurationManager";
import { UploadServiceManager } from "./UploaderManager";
import { UploadEventHandler } from "../handler/UploadEventHandler";
import { DeleteEventHandler } from "../handler/DeleteEventHandler";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { findSupportedLocalFilePath, findUploadedFileLinks } from "../utils/FileUtils";


export class EventHandlerManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private uploadServiceManager: UploadServiceManager;
  private uploadEventHandler: UploadEventHandler;
  private deleteEventHandler: DeleteEventHandler;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
  ) {
    this.app = app;
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
    const selectedText = editor.getSelection();
    if (!selectedText) {
      return;
    }

    const supportedTypes = this.configurationManager.getSettings().autoUploadFileTypes;
    const localFiles = findSupportedLocalFilePath(selectedText, supportedTypes);
    if (localFiles.length > 0) {
      menu.addItem((item) => {
        item
          .setTitle(t("upload.localFile"))
          .setIcon('upload')
          .onClick(async () => {
            const dataTransfer = new DataTransfer();
            for (const filePath of localFiles) {
              try {
                const arrayBuffer = await this.app.vault.adapter.readBinary(filePath);
                const fileName = filePath.split('/').pop() || 'file';
                const uploadFile = new File([new Blob([arrayBuffer])], fileName);
                dataTransfer.items.add(uploadFile);
              } catch (error) {
                logger.error("EventHandlerManager", "Failed to upload local file", error);
              }
            }
            void this.uploadEventHandler.handleFileUploadEvent(dataTransfer.items);
          });
      });
    }

    const publicDomain = this.configurationManager.getSettings().uploaderConfig.public_domain as string;
    const uploadedFileLinks = findUploadedFileLinks(selectedText, publicDomain);
        if (uploadedFileLinks.length > 0) {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle(t("delete.menuTitle"))
          .setIcon("trash")
          .setWarning(true)
          .onClick(() => {
            void this.deleteEventHandler.handleDeleteUploadedFiles(
              uploadedFileLinks,
              editor,
              view,
            );
          });
      });
    }
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

  /**
   * Check upload queue status and wait for completion before unload
   * Shows notices to user about pending uploads
   */
  public checkQueueStatusOnUnload(): void {
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
  }
}
