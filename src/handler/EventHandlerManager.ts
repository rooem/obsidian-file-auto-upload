import { App, Notice, MarkdownView, Menu, MenuItem, Editor } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { UploadEventHandler } from "./UploadEventHandler";
import { DeleteEventHandler } from "./DeleteEventHandler";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { findSupportedLocalFilePath as findSupportedViewFilePath, findUploadedFileLinks } from "../utils/FileUtils";
import { EventType, ProcessItem } from "../types/index";


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

  public async handleClipboardPaste(
    evt: ClipboardEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    const settings = this.configurationManager.getSettings();
    if (!settings.clipboardAutoUpload || !evt.clipboardData || !evt.clipboardData.items) {
      return;
    }

    if (this.canHandle(evt.clipboardData.items)) {
      evt.preventDefault();
      const processItems = await this.getProcessItemList(evt.clipboardData.items);
      void this.uploadEventHandler.handleFileUploadEvent(processItems);
    }
  }

  public async handleFileDrop(
    evt: DragEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    const settings = this.configurationManager.getSettings();
    if (!settings.dragAutoUpload || !evt.dataTransfer || !evt.dataTransfer.items) {
      return;
    }

    if (this.canHandle(evt.dataTransfer.items)) {
      evt.preventDefault();
      const processItems = await this.getProcessItemList(evt.dataTransfer.items);
      void this.uploadEventHandler.handleFileUploadEvent(processItems);
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
          const processItems = await this.getProcessItemListFromView(localFiles);
          if (this.canHandle(processItems)) {
            void this.uploadEventHandler.handleFileUploadEvent(processItems);
          }
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

  private canHandle(items: Array<ProcessItem> | DataTransferItemList): boolean {
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

  private async getProcessItemList(items: DataTransferItemList): Promise<Array<ProcessItem>> {
    const queue: Array<ProcessItem> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const uploadId = `u${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
      if (item.kind === "string" && item.type === "text/plain") {
        const text = await new Promise<string>((resolve) =>
          item.getAsString(resolve),
        );
        queue.push({ id: uploadId, eventType: EventType.UPLOAD, type: "text", value: text });
        continue;
      }

      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry?.isDirectory) {
          logger.debug("UploadEventHandler", "Detected directory drop", {
            name: entry.name,
          });
          continue;
        }
        const file = item.getAsFile();
        if (!file) {
          continue;
        }
        const extension = file.name.split(".").pop()?.toLowerCase()
        queue.push({ id: uploadId, eventType: EventType.UPLOAD, type: "file", value: file, extension: extension });
      }
    }
    return queue;
  }

  /**
  * Extract files and text from DataTransferItemList or local file array
  * @param items - DataTransferItemList from event or array of local files
  * @returns Queue of items to process
  */
  private async getProcessItemListFromView(filePathList: string[]): Promise<Array<ProcessItem>> {
    const queue: Array<ProcessItem> = [];
    if (!filePathList || filePathList.length == 0) {
      return queue;
    }

    for (const filePath of filePathList) {
      try {
        const arrayBuffer = await this.app.vault.adapter.readBinary(filePath);
        const fileName = filePath.split('/').pop() || 'file';
        const file = new File([new Blob([arrayBuffer])], fileName);
        const uploadId = `u${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
        queue.push({
          id: uploadId,
          eventType: EventType.UPLOAD,
          type: "file",
          value: file,
          extension: fileName.split(".").pop()?.toLowerCase(),
          localPath: filePath
        });
      } catch (error) {
        logger.error("LocalFileUploadHandler", "Failed to read local file", { filePath, error });
      }
    }

    return queue;
  }

}
