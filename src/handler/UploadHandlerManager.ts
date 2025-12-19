import {
  App,
  Notice,
  MarkdownView,
  Menu,
  Editor,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { StorageServiceManager } from "../storage/StorageServiceManager";
import { StatusBar } from "../components/StatusBar";
import { UploadEventHandler } from "./providers/UploadHandler";
import { FolderUploadHandler } from "./providers/FolderUploadHandler";
import { t } from "../i18n";
import { logger } from "../common/Logger";
import { generateUniqueId } from "../common/FileUtils";
import {
  findSupportedFilePath,
  scanFolderForUploadableFiles,
} from "../common/MarkdownLinkFinder";
import { FolderActionModal, FolderActionResult, FolderActionConfig } from "../components/FolderActionModal";
import {
  EventType,
  ProcessItem,
  TextProcessItem,
  FileProcessItem,
} from "../types/index";

export class UploadHandlerManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private storageServiceManager: StorageServiceManager;
  private statusBar: StatusBar;
  private uploadEventHandler: UploadEventHandler;
  private folderUploadHandler: FolderUploadHandler;

  private UPLOAD_CONFIG: FolderActionConfig = {
    titleKey: "upload.folderScanTitle",
    resultKey: "upload.folderScanResult",
    actionBtnKey: "upload.folderUploadBtn",
    progressKey: "upload.uploading",
    scanningKey: "upload.scanning",
    closeKey: "upload.folderScanClose",
  };

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
    statusBar: StatusBar,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.storageServiceManager = storageServiceManager;
    this.statusBar = statusBar;
    this.uploadEventHandler = new UploadEventHandler(
      this.app,
      this.configurationManager,
      this.storageServiceManager,
      this.statusBar,
    );
    this.folderUploadHandler = new FolderUploadHandler(
      this.app,
      this.configurationManager,
      this.storageServiceManager,
    );
  }

  public async handleDataTransfer(
    evt: ClipboardEvent | DragEvent,
    _editor: Editor,
    _view: MarkdownView,
  ): Promise<void> {
    const isClipboard = evt instanceof ClipboardEvent;
    const items = isClipboard
      ? (evt as ClipboardEvent).clipboardData?.items
      : (evt as DragEvent).dataTransfer?.items;

    if (!items) return;

    const autoUploadEnabled = isClipboard
      ? this.configurationManager.isClipboardAutoUpload()
      : this.configurationManager.isDragAutoUpload();

    if (!autoUploadEnabled) return;

    if (!isClipboard && !this.hasSupportedFile(items)) return;

    if (this.canHandle(items)) {
      evt.preventDefault();
      const processItems = await this.getProcessItemList(items);
      void this.uploadEventHandler.handleFileUploadEvent(processItems);
    }
  }

  public addUploadAllLocalFilesMenu(menu: Menu, target: TFile | TFolder): void {
    menu.addItem((item) => {
      item.setTitle(t("upload.allLocalFiles")).setIcon("upload").onClick(async () => {
        const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
        const result: FolderActionResult & { uploadableFiles: { filePath: string; docPaths: string[] }[] } = {
          totalDocs: 0,
          fileCount: 0,
          uploadableFiles: []
        };

        const modal = new FolderActionModal(
          this.app,
          result,
          this.UPLOAD_CONFIG,
          (onProgress) => this.folderUploadHandler.handleUploadFiles(result.uploadableFiles, onProgress)
        );
        modal.open();

        const scanResult = await scanFolderForUploadableFiles(
          this.app,
          target,
          supportedTypes,
          (current, total) => modal.updateScanProgress(current, total)
        );

        result.totalDocs = scanResult.totalDocs;
        result.fileCount = scanResult.uploadableFiles.length;
        result.uploadableFiles = scanResult.uploadableFiles;

        modal.contentEl.empty();
        modal.onOpen();
      });
    });
  }

  public handleUploadViewFile(menu: Menu, editor: Editor): void {
    const localFiles = this.getLocalFiles(editor.getSelection());
    if (!localFiles.length) return;

    menu.addItem((item) => {
      item.setTitle(t("upload.localFile")).setIcon("upload").onClick(() => this.uploadLocalFiles(localFiles));
    });
  }

  public getQueueStatus() {
    return this.uploadEventHandler.getQueueStatus();
  }

  public dispose(): void {
    this.uploadEventHandler.dispose();
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

  private hasSupportedFile(items: DataTransferItemList): boolean {
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (ext && supportedTypes.includes(ext)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private canHandle(items: ProcessItem[] | DataTransferItemList): boolean {
    if (items && items.length === 0) {
      return false;
    }

    logger.debug("UploadManager", "File upload event triggered", {
      itemCount: items.length,
    });

    const result = this.storageServiceManager.checkConnectionConfig();
    if (!result.success) {
      logger.warn("UploadManager", "Connection config invalid, showing config modal");
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
          continue;
        }
        const file = item.getAsFile();
        if (!file) {
          continue;
        }
        queue.push({
          id: generateUniqueId("u", file),
          eventType: EventType.UPLOAD,
          type: "file",
          value: file,
          extension: file.name.split(".").pop()?.toLowerCase(),
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

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return queue;
    }

    for (const filePath of filePathList) {
      try {
        let decodedPath: string;
        try {
          decodedPath = normalizePath(decodeURIComponent(filePath));
        } catch {
          decodedPath = normalizePath(filePath);
        }
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
        logger.error("UploadManager", "Failed to read local file", { filePath, error });
        new Notice(t("upload.readFileFailed").replace("{path}", filePath), 3000);
      }
    }

    return queue;
  }
}
