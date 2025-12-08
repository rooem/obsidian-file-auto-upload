import { App, Notice, MarkdownView, Menu, MenuItem, Editor } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { StatusBar } from "../components/StatusBar";
import { UploadEventHandler } from "./UploadEventHandler";
import { DeleteEventHandler } from "./DeleteEventHandler";
import { DownloadHandler } from "./DownloadHandler";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import {
  findSupportedFilePath as findSupportedViewFilePath,
  findUploadedFileLinks,
  extractFileKeyFromUrl,
  generateUniqueId,
} from "../utils/FileUtils";
import {
  EventType,
  ProcessItem,
  DeleteProcessItem,
  TextProcessItem,
  FileProcessItem,
  DownloadProcessItem,
} from "../types/index";

export class EventHandlerManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private uploadServiceManager: UploadServiceManager;
  private uploadEventHandler: UploadEventHandler;
  private deleteEventHandler: DeleteEventHandler;
  private downloadHandler: DownloadHandler;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
    statusBarManager: StatusBar,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.uploadServiceManager = uploadServiceManager;
    this.uploadEventHandler = new UploadEventHandler(
      app,
      configurationManager,
      uploadServiceManager,
      statusBarManager,
    );

    this.deleteEventHandler = new DeleteEventHandler(
      app,
      configurationManager,
      uploadServiceManager,
    );

    this.downloadHandler = new DownloadHandler(
      app,
      configurationManager,
      statusBarManager,
    );
  }

  public async handleClipboardPaste(
    evt: ClipboardEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    const settings = this.configurationManager.getSettings();
    if (
      !settings.clipboardAutoUpload ||
      !evt.clipboardData ||
      !evt.clipboardData.items
    ) {
      return;
    }

    if (this.canHandle(evt.clipboardData.items)) {
      evt.preventDefault();
      const processItems = await this.getProcessItemList(
        evt.clipboardData.items,
      );
      void this.uploadEventHandler.handleFileUploadEvent(processItems);
    }
  }

  public async handleFileDrop(
    evt: DragEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    const settings = this.configurationManager.getSettings();
    if (
      !settings.dragAutoUpload ||
      !evt.dataTransfer ||
      !evt.dataTransfer.items
    ) {
      return;
    }

    if (this.canHandle(evt.dataTransfer.items)) {
      evt.preventDefault();
      const processItems = await this.getProcessItemList(
        evt.dataTransfer.items,
      );
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

    this.handleDownloadFile(menu, editor, view);

    this.handleDeleteFile(menu, editor, view);
  }

  public dispose(): void {
    const handlers = [
      this.uploadEventHandler,
      this.deleteEventHandler,
      this.downloadHandler,
    ];
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

  private handleUploadViewFile(
    menu: Menu,
    editor: Editor,
    _view: MarkdownView,
  ): void {
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    const localFiles = findSupportedViewFilePath(
      editor.getSelection(),
      supportedTypes,
    );
    if (!localFiles || localFiles.length === 0) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle(t("upload.localFile"))
        .setIcon("upload")
        .onClick(async () => {
          const processItems =
            await this.getProcessItemListFromView(localFiles);
          if (this.canHandle(processItems)) {
            void this.uploadEventHandler.handleFileUploadEvent(processItems);
          }
        });
    });
  }

  private handleDownloadFile(
    menu: Menu,
    editor: Editor,
    _view: MarkdownView,
  ): void {
    const publicDomain = this.configurationManager.getPublicDomain();
    const uploadedFileLinks = findUploadedFileLinks(
      editor.getSelection(),
      publicDomain,
    );
    if (!uploadedFileLinks || uploadedFileLinks.length === 0) {
      return;
    }

    const processItems: DownloadProcessItem[] = uploadedFileLinks.map(
      (url) => ({
        id: generateUniqueId("dl"),
        eventType: EventType.DOWNLOAD,
        type: "download",
        url,
      }),
    );

    menu.addItem((item: MenuItem) => {
      item
        .setTitle(t("download.menuTitle"))
        .setIcon("download")
        .onClick(() => {
          this.downloadHandler.handleDownloadFiles(processItems);
        });
    });
  }

  private handleDeleteFile(
    menu: Menu,
    editor: Editor,
    _view: MarkdownView,
  ): void {
    const publicDomain = this.configurationManager.getPublicDomain();
    const uploadedFileLinks = findUploadedFileLinks(
      editor.getSelection(),
      publicDomain,
    );
    if (!uploadedFileLinks || uploadedFileLinks.length === 0) {
      return;
    }

    const originalSelection = editor.getSelection();
    if (!originalSelection) {
      logger.warn("EventHandlerManager", "No text selected");
      return;
    }

    const processItems: DeleteProcessItem[] = uploadedFileLinks.map((link) => ({
      id: generateUniqueId("d"),
      eventType: EventType.DELETE,
      type: "text",
      fileLink: link,
      fileKey: extractFileKeyFromUrl(link, publicDomain),
      originalSelection: originalSelection,
    }));

    if (this.canHandle(processItems)) {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle(t("delete.menuTitle"))
          .setIcon("trash")
          .setWarning(true)
          .onClick(() => {
            void this.deleteEventHandler.handleDeleteUploadedFiles(
              processItems,
            );
          });
      });
    }
  }

  private canHandle(items: ProcessItem[] | DataTransferItemList): boolean {
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

  private async getProcessItemList(
    items: DataTransferItemList,
  ): Promise<Array<TextProcessItem | FileProcessItem>> {
    const queue: Array<TextProcessItem | FileProcessItem> = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "string" && item.type === "text/plain") {
        const text = await new Promise<string>((resolve) =>
          item.getAsString(resolve),
        );
        queue.push({
          id: generateUniqueId("u"),
          eventType: EventType.UPLOAD,
          type: "text",
          value: text,
        } as TextProcessItem);
        continue;
      }

      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry?.isDirectory) {
          logger.debug("EventHandlerManager", "Skipping directory", {
            name: entry.name,
          });
          continue;
        }
        const file = item.getAsFile();
        if (!file) {
          continue;
        }
        const uploadId = generateUniqueId("u",file);
        const extension = file.name.split(".").pop()?.toLowerCase();
        queue.push({
          id: uploadId,
          eventType: EventType.UPLOAD,
          type: "file",
          value: file,
          extension: extension,
        } as FileProcessItem);
      }
    }
    return queue;
  }

  private async getProcessItemListFromView(
    filePathList: string[],
  ): Promise<FileProcessItem[]> {
    const queue: FileProcessItem[] = [];
    if (!filePathList || filePathList.length === 0) {
      return queue;
    }

    for (const filePath of filePathList) {
      try {
        const arrayBuffer = await this.app.vault.adapter.readBinary(filePath);
        const fileName = filePath.split("/").pop() || "file";
        const file = new File([new Blob([arrayBuffer])], fileName);
        const uploadId = generateUniqueId("u",file);
        queue.push({
          id: uploadId,
          eventType: EventType.UPLOAD,
          type: "file",
          value: file,
          extension: fileName.split(".").pop()?.toLowerCase(),
          localPath: filePath,
        } as FileProcessItem);
      } catch (error) {
        logger.error("EventHandlerManager", "Failed to read local file", {
          filePath,
          error,
        });
      }
    }

    return queue;
  }
}
