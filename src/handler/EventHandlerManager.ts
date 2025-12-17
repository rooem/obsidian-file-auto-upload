import {
  App,
  Notice,
  MarkdownView,
  Menu,
  MenuItem,
  Editor,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import { Extension } from "@codemirror/state";
import { MarkdownPostProcessorContext } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { StorageServiceManager } from "../storage/StorageServiceManager";
import { StatusBar } from "../components/StatusBar";
import { UploadEventHandler } from "./providers/UploadEventHandler";
import { DeleteEventHandler } from "./providers/DeleteEventHandler";
import { DownloadHandler } from "./providers/DownloadHandler";
import { FolderUploadHandler } from "./providers/FolderUploadHandler";
import { WebdavImageLoader } from "../components/WebdavImageLoader";
import { t } from "../i18n";
import { logger } from "../common/Logger";
import { Constants } from "../common/Constants";
import { extractFileKeyFromUrl, generateUniqueId } from "../common/FileUtils";
import {
  findSupportedFilePath,
  findUploadedFileLinks,
} from "../common/MarkdownLinkFinder";
import {
  EventType,
  ProcessItem,
  DeleteProcessItem,
  TextProcessItem,
  FileProcessItem,
  DownloadProcessItem,
  Result,
} from "../types/index";

/**
 * Central manager for handling various Obsidian events
 * Coordinates upload, download, and delete operations based on user interactions
 */
export class EventHandlerManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private statusBar: StatusBar;

  private _storageServiceManager?: StorageServiceManager;
  private _uploadEventHandler?: UploadEventHandler;
  private _deleteEventHandler?: DeleteEventHandler;
  private _downloadHandler?: DownloadHandler;
  private _folderUploadHandler?: FolderUploadHandler;
  private _webdavImageLoader?: WebdavImageLoader;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    statusBar: StatusBar,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.statusBar = statusBar;

    // Listen for config changes to update WebdavImageLoader prefixes
    this.configurationManager.addConfigChangeListener(() => {
      this._webdavImageLoader?.updatePrefixes();
    });
  }

  /**
   * Test connection to storage service
   * Performs actual connection test by uploading and deleting a test file
   * @returns Result indicating test success or failure
   */
  async testConnection(): Promise<Result> {
    return await this.storageServiceManager.testConnection();
  }

  /**
   * Handle clipboard paste events
   * Triggers file upload workflow for pasted files
   * @param evt - Clipboard event containing pasted data
   * @param _editor - Editor instance (unused)
   * @param _view - Markdown view instance (unused)
   */
  public async handleClipboardPaste(
    evt: ClipboardEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    if (
      !this.configurationManager.isClipboardAutoUpload() ||
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

  /**
   * Handle file drop events
   * Triggers file upload workflow for dropped files
   * @param evt - Drag event containing dropped files
   * @param _editor - Editor instance (unused)
   * @param _view - Markdown view instance (unused)
   */
  public async handleFileDrop(
    evt: DragEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    if (
      !this.configurationManager.isDragAutoUpload() ||
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

  /**
   * Handle file context menu in file explorer
   * Adds upload/download options for markdown files
   * @param menu - Context menu to add items to
   * @param file - Target file for the context menu
   */
  public handleFileMenu(menu: Menu, file: TFile): void {
    // Only handle markdown files
    if (file.extension !== "md") {
      return;
    }
    this.handleDownloadAllFilesFromFile(menu, file);
    this.handleUploadAllFilesFromFile(menu, file);
  }

  /**
   * Handle folder context menu in file explorer
   * Adds upload option for all files in folder
   * @param menu - Context menu to add items to
   * @param folder - Target folder for the context menu
   */
  public handleFolderMenu(menu: Menu, folder: TFolder): void {
    menu.addItem((item) => {
      item.setTitle(t("upload.folderFiles")).setIcon("upload").onClick(async () => {
        await this.folderUploadHandler.scanAndShowFolderFiles(folder);
      });
    });
  }

  /**
   * Handle editor context menu
   * Adds upload/download/delete options based on selected content
   * @param menu - Context menu to add items to
   * @param editor - Editor instance with selected content
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

    this.handleUploadViewFile(menu, editor, view);

    this.handleDownloadFile(menu, editor, view);

    this.handleDeleteFile(menu, editor, view);
  }

  /**
   * Handle editor context menu
   * Adds upload/download/delete options based on selected content
   * @param menu - Context menu to add items to
   * @param editor - Editor instance with selected content
   * @param view - Markdown view instance
   */
  public createEditorExtension(): Extension {
    return this.webdavImageLoader.createExtension();
  }

  /**
   * Create markdown post processor for reading view and PDF export
   * Uses concurrency limit to avoid loading too many images simultaneously
   */
  public createMarkdownPostProcessor() {
    return async (el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
      const images = Array.from(el.querySelectorAll("img"));
      for (let i = 0; i < images.length; i += Constants.MAX_CONCURRENT) {
        const batch = images.slice(i, i + Constants.MAX_CONCURRENT);
        await Promise.all(
          batch.map((img) => this.webdavImageLoader.loadImage(img, true)),
        );
      }
    };
  }

  /**
   * Dispose of event handler manager and notify about pending operations
   * Shows warning notice if there are operations in progress
   */
  public dispose(): void {
    const handlers = [
      this._uploadEventHandler,
      this._deleteEventHandler,
      this._downloadHandler,
    ].filter(Boolean) as (
      | UploadEventHandler
      | DeleteEventHandler
      | DownloadHandler
    )[];

    if (handlers.length > 0) {
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

    this._storageServiceManager?.dispose();
    this.statusBar.dispose();
    this._webdavImageLoader?.destroy();
  }

  private get storageServiceManager(): StorageServiceManager {
    if (!this._storageServiceManager) {
      this._storageServiceManager = new StorageServiceManager(
        this.configurationManager,
      );
    }
    return this._storageServiceManager;
  }

  private get uploadEventHandler(): UploadEventHandler {
    if (!this._uploadEventHandler) {
      this._uploadEventHandler = new UploadEventHandler(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
        this.statusBar,
      );
    }
    return this._uploadEventHandler;
  }

  private get deleteEventHandler(): DeleteEventHandler {
    if (!this._deleteEventHandler) {
      this._deleteEventHandler = new DeleteEventHandler(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
      );
    }
    return this._deleteEventHandler;
  }

  private get downloadHandler(): DownloadHandler {
    if (!this._downloadHandler) {
      this._downloadHandler = new DownloadHandler(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
        this.statusBar,
      );
    }
    return this._downloadHandler;
  }

  private get folderUploadHandler(): FolderUploadHandler {
    if (!this._folderUploadHandler) {
      this._folderUploadHandler = new FolderUploadHandler(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
      );
    }
    return this._folderUploadHandler;
  }

  private get webdavImageLoader(): WebdavImageLoader {
    if (!this._webdavImageLoader) {
      this._webdavImageLoader = new WebdavImageLoader(
        this.configurationManager,
      );
    }
    return this._webdavImageLoader;
  }

  private handleUploadViewFile(menu: Menu, editor: Editor, _view: MarkdownView): void {
    const localFiles = this.getLocalFiles(editor.getSelection());
    if (!localFiles.length) return;

    menu.addItem((item) => {
      item.setTitle(t("upload.localFile")).setIcon("upload").onClick(() => this.uploadLocalFiles(localFiles));
    });
  }

  private handleDownloadFile(menu: Menu, editor: Editor, _view: MarkdownView): void {
    const links = this.getUploadedLinks(editor.getSelection());
    if (!links.length) return;

    menu.addItem((item: MenuItem) => {
      item.setTitle(t("download.menuTitle")).setIcon("download").onClick(() => {
        this.downloadHandler.handleDownloadFiles(this.createDownloadItems(links));
      });
    });
  }

  private handleDownloadAllFilesFromFile(menu: Menu, file: TFile): void {
    menu.addItem((item: MenuItem) => {
      item.setTitle(t("download.allMenuTitle")).setIcon("download").onClick(async () => {
        const links = this.getUploadedLinks(await this.app.vault.read(file));
        if (!links.length) {
          new Notice(t("download.noFiles"), 1000);
          return;
        }
        this.downloadHandler.handleDownloadFiles(this.createDownloadItems(links));
      });
    });
  }

  private getUploadedLinks(content: string): string[] {
    return findUploadedFileLinks(content, this.configurationManager.getPublicDomain()) || [];
  }

  private createDownloadItems(urls: string[]): DownloadProcessItem[] {
    return urls.map((url) => ({
      id: generateUniqueId("dl"),
      eventType: EventType.DOWNLOAD,
      type: "download",
      url,
    }));
  }

  private handleUploadAllFilesFromFile(menu: Menu, file: TFile): void {
    menu.addItem((item) => {
      item.setTitle(t("upload.allLocalFiles")).setIcon("upload").onClick(async () => {
        const localFiles = this.getLocalFiles(await this.app.vault.read(file));
        if (!localFiles.length) {
          new Notice(t("upload.noFiles"), 1000);
          return;
        }
        await this.uploadLocalFiles(localFiles);
      });
    });
  }

  private getLocalFiles(content: string): string[] {
    return findSupportedFilePath(content, this.configurationManager.getAutoUploadFileTypes()) || [];
  }

  private async uploadLocalFiles(localFiles: string[]): Promise<void> {
    const processItems = await this.getProcessItemListFromView(localFiles);
    if (this.canHandle(processItems)) {
      void this.uploadEventHandler.handleFileUploadEvent(processItems);
    }
  }

  private handleDeleteFile(menu: Menu, editor: Editor, _view: MarkdownView): void {
    const links = this.getUploadedLinks(editor.getSelection());
    const selection = editor.getSelection();
    if (!links.length || !selection) return;

    const publicDomain = this.configurationManager.getPublicDomain();
    const processItems: DeleteProcessItem[] = links.map((link) => ({
      id: generateUniqueId("d"),
      eventType: EventType.DELETE,
      type: "text",
      fileLink: link,
      fileKey: extractFileKeyFromUrl(link, publicDomain),
      originalSelection: selection,
    }));

    if (this.canHandle(processItems)) {
      menu.addItem((item: MenuItem) => {
        item.setTitle(t("delete.menuTitle")).setIcon("trash").setWarning(true).onClick(() => {
          void this.deleteEventHandler.handleDeleteUploadedFiles(processItems);
        });
      });
    }
  }

  /**
   * Check if items can be handled for processing
   * Validates connection configuration before proceeding
   */
  private canHandle(items: ProcessItem[] | DataTransferItemList): boolean {
    if (items && items.length === 0) {
      return false;
    }

    logger.debug("EventHandlerManager", "File upload event triggered", {
      itemCount: items.length,
    });

    const result = this.storageServiceManager.checkConnectionConfig();
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
   * Convert DataTransferItemList to ProcessItem array
   * Extracts files and text from clipboard/drag data
   */
  private async getProcessItemList(
    items: DataTransferItemList,
  ): Promise<Array<TextProcessItem | FileProcessItem>> {
    const queue: Array<TextProcessItem | FileProcessItem> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Handle text content
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

      // Handle file content
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
        const uploadId = generateUniqueId("u", file);
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

  /**
   * Create ProcessItem array from local file paths
   * Reads file content from the vault for upload
   */
  private async getProcessItemListFromView(
    filePathList: string[],
  ): Promise<FileProcessItem[]> {
    const queue: FileProcessItem[] = [];
    if (!filePathList || filePathList.length === 0) {
      return queue;
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return queue;
    }

    for (const filePath of filePathList) {
      try {
        const decodedPath = normalizePath(decodeURIComponent(filePath));
        const tfile = this.app.metadataCache.getFirstLinkpathDest(
          decodedPath,
          activeFile.path,
        );
        let arrayBuffer, file;
        if (tfile instanceof TFile) {
          arrayBuffer = await this.app.vault.readBinary(tfile);
          const fileName = tfile.name || "file";
          file = new File([new Blob([arrayBuffer])], fileName);
        } else {
          arrayBuffer = await this.app.vault.adapter.readBinary(decodedPath);
          const fileName = decodedPath.split("/").pop() || "file";
          file = new File([new Blob([arrayBuffer])], fileName);
        }

        queue.push({
          id: generateUniqueId("u", file),
          eventType: EventType.UPLOAD,
          type: "file",
          value: file,
          extension: file.name.split(".").pop()?.toLowerCase(),
          localPath: filePath,
        } as FileProcessItem);
      } catch (error) {
        logger.error("EventHandlerManager", "Failed to read local file", {
          filePath,
          error,
        });
        new Notice(t("upload.readFileFailed").replace("{path}", filePath), 3000);
      }
    }

    return queue;
  }
}
