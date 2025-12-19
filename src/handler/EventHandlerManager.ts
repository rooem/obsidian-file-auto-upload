import {
  App,
  Notice,
  MarkdownView,
  Menu,
  MenuItem,
  Editor,
  TFile,
  TFolder,
} from "obsidian";
import { Extension } from "@codemirror/state";
import { MarkdownPostProcessorContext } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { StorageServiceManager } from "../storage/StorageServiceManager";
import { StatusBar } from "../components/StatusBar";
import { DeleteEventHandler } from "./providers/DeleteHandler";
import { UploadHandlerManager } from "./UploadHandlerManager";
import { DownloadHandlerManager } from "./DownloadHandlerManager";
import { WebdavImageLoader } from "../components/WebdavImageLoader";
import { t } from "../i18n";
import { Constants } from "../common/Constants";
import { extractFileKeyFromUrl, generateUniqueId } from "../common/FileUtils";
import { findUploadedFileLinks } from "../common/MarkdownLinkFinder";
import { EventType, DeleteProcessItem, Result } from "../types/index";

export class EventHandlerManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private statusBar: StatusBar;

  private _storageServiceManager?: StorageServiceManager;
  private _uploadHandlerManager?: UploadHandlerManager;
  private _downloadHandlerManager?: DownloadHandlerManager;
  private _deleteEventHandler?: DeleteEventHandler;
  private _webdavImageLoader?: WebdavImageLoader;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    statusBar: StatusBar,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.statusBar = statusBar;

    this.configurationManager.addConfigChangeListener(() => {
      this._webdavImageLoader?.updatePrefixes();
    });
  }

  async testConnection(): Promise<Result> {
    return await this.storageServiceManager.testConnection();
  }

  public async handleClipboardPaste(
    evt: ClipboardEvent,
    editor: Editor,
    view: MarkdownView,
  ): Promise<void> {
    return this.uploadHandlerManager.handleDataTransfer(evt, editor, view);
  }

  public async handleFileDrop(
    evt: DragEvent,
    editor: Editor,
    view: MarkdownView,
  ): Promise<void> {
    return this.uploadHandlerManager.handleDataTransfer(evt, editor, view);
  }

  public handleFileMenu(menu: Menu, file: TFile): void {
    if (file.extension !== "md") {
      return;
    }
    this.downloadHandlerManager.handleDownloadMenu(menu, file);
    this.uploadHandlerManager.handleUploadMenu(menu, file);
  }

  public handleFolderMenu(menu: Menu, folder: TFolder): void {
    this.downloadHandlerManager.handleDownloadMenu(menu, folder);
    this.uploadHandlerManager.handleUploadMenu(menu, folder);
  }

  public handleEditorContextMenu(
    menu: Menu,
    editor: Editor,
    _view: MarkdownView,
  ): void {
    const selectedText = editor.getSelection();
    if (!selectedText) {
      return;
    }

    this.uploadHandlerManager.handleUploadFile(menu, editor);
    this.downloadHandlerManager.handleDownloadFile(menu, editor);
    this.handleDeleteFile(menu, editor);
  }

  public createEditorExtension(): Extension {
    return this.webdavImageLoader.createExtension();
  }

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

  public dispose(): void {
    const statuses = [
      this._uploadHandlerManager?.getQueueStatus(),
      this._downloadHandlerManager?.getQueueStatus(),
      this._deleteEventHandler?.getQueueStatus(),
    ].filter(Boolean);

    const totalQueueLength = statuses.reduce(
      (sum, status) => sum + (status?.queueLength || 0),
      0,
    );
    const isProcessing = statuses.some((status) => status?.isProcessing);

    if (totalQueueLength > 0 || isProcessing) {
      new Notice(
        t("notice.queueLost").replace("{count}", totalQueueLength.toString()),
        3000,
      );
    }

    this._uploadHandlerManager?.dispose();
    this._downloadHandlerManager?.dispose();
    this._deleteEventHandler?.dispose();
    this._storageServiceManager?.dispose();
    this.statusBar.dispose();
    this._webdavImageLoader?.destroy();
  }

  private handleDeleteFile(menu: Menu, editor: Editor): void {
    const selection = editor.getSelection();
    const links =
      findUploadedFileLinks(
        selection,
        this.configurationManager.getPublicDomain(),
      ) || [];
    if (!links.length || !selection) {
      return;
    }

    const publicDomain = this.configurationManager.getPublicDomain();
    const processItems: DeleteProcessItem[] = links.map((link) => ({
      id: generateUniqueId("d"),
      eventType: EventType.DELETE,
      type: "text",
      fileLink: link,
      fileKey: extractFileKeyFromUrl(link, publicDomain),
      originalSelection: selection,
    }));

    if (processItems.length > 0) {
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

  private get storageServiceManager(): StorageServiceManager {
    if (!this._storageServiceManager) {
      this._storageServiceManager = new StorageServiceManager(
        this.configurationManager,
      );
    }
    return this._storageServiceManager;
  }

  private get uploadHandlerManager(): UploadHandlerManager {
    if (!this._uploadHandlerManager) {
      this._uploadHandlerManager = new UploadHandlerManager(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
        this.statusBar,
      );
    }
    return this._uploadHandlerManager;
  }

  private get downloadHandlerManager(): DownloadHandlerManager {
    if (!this._downloadHandlerManager) {
      this._downloadHandlerManager = new DownloadHandlerManager(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
        this.statusBar,
      );
    }
    return this._downloadHandlerManager;
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

  private get webdavImageLoader(): WebdavImageLoader {
    if (!this._webdavImageLoader) {
      this._webdavImageLoader = new WebdavImageLoader(
        this.configurationManager,
      );
    }
    return this._webdavImageLoader;
  }
}
