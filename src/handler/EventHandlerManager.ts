import { App, Notice, MarkdownView, Menu, MenuItem, Editor } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { UploadEventHandler } from "./UploadEventHandler";
import { DeleteEventHandler } from "./DeleteEventHandler";
import { LocalFileUploadHandler } from "./LocalFileUploadHandler";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { findSupportedLocalFilePath as findSupportedViewFilePath, findUploadedFileLinks } from "../utils/FileUtils";


export class EventHandlerManager {
  private configurationManager: ConfigurationManager;
  private uploadServiceManager: UploadServiceManager;
  private uploadEventHandler: UploadEventHandler;
  private deleteEventHandler: DeleteEventHandler;
  private localFileUploadHandler: LocalFileUploadHandler;

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

    this.localFileUploadHandler = new LocalFileUploadHandler(
      app,
      this.uploadEventHandler,
    );
  }

  public handleClipboardPaste(
    evt: ClipboardEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): void {
    const settings = this.configurationManager.getSettings();
    if (!settings.clipboardAutoUpload || !evt.clipboardData || !evt.clipboardData.items) {
      return;
    }

    if (this.canHandle(evt.clipboardData.items)) {
       evt.preventDefault();
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
    if (!settings.dragAutoUpload || !evt.dataTransfer || !evt.dataTransfer.items) {
      return;
    }
    
    if (this.canHandle(evt.dataTransfer.items)) {
       evt.preventDefault();
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

    this.handleUploadViewFile(menu, editor, view);

    this.handleDeleteFile(menu, editor, view);
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

    handlers.forEach((handler) => handler.dispose());
  }

  private canHandle(items: DataTransferItemList): boolean {
    if (items && items.length === 0) {
      return false;
    }

    logger.debug("EventHandlerManager", "File upload event triggered", {
      itemCount: items.length,
    });

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

  private handleUploadViewFile(menu: Menu, editor: Editor, view: MarkdownView): void {
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    const localFiles = findSupportedViewFilePath(editor.getSelection(), supportedTypes);
    if (!localFiles || localFiles.length === 0) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle(t("upload.localFile"))
        .setIcon('upload')
        .onClick(async () => {
          const result = this.uploadServiceManager.checkConnectionConfig();
          if (!result.success) {
            logger.warn("EventHandlerManager", "Connection config invalid, showing config modal");
            this.configurationManager.showStorageConfigModal();
            return;
          }
          await this.localFileUploadHandler.handleLocalFileUpload(localFiles);
        });
    });
  }


  private handleDeleteFile(menu: Menu, editor: Editor, view: MarkdownView): void {
    const publicDomain = this.configurationManager.getPublicDomain();
    const uploadedFileLinks = findUploadedFileLinks(editor.getSelection(), publicDomain);
    if (!uploadedFileLinks || uploadedFileLinks.length === 0) {
      return;
    }

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
