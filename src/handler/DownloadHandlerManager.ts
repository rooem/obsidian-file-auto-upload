import {
  App,
  Menu,
  MenuItem,
  Editor,
  TFile,
  TFolder,
} from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { StorageServiceManager } from "../storage/StorageServiceManager";
import { StatusBar } from "../components/StatusBar";
import { DownloadHandler } from "./providers/DownloadHandler";
import { FolderDownloadHandler } from "./providers/FolderDownloadHandler";
import { t } from "../i18n";
import { generateUniqueId } from "../common/FileUtils";
import { findUploadedFileLinks, scanFolderForDownloadableFiles, DownloadableFile } from "../common/MarkdownLinkFinder";
import { FolderActionModal, FolderActionResult, FolderActionConfig } from "../components/FolderActionModal";
import { EventType, DownloadProcessItem } from "../types/index";

export class DownloadManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private storageServiceManager: StorageServiceManager;
  private statusBar: StatusBar;
  private DOWNLOAD_CONFIG: FolderActionConfig = {
  titleKey: "download.folderScanTitle",
  resultKey: "download.folderScanResult",
  actionBtnKey: "download.folderDownloadBtn",
  progressKey: "download.progressing",
  scanningKey: "download.scanning",
  closeKey: "download.folderScanClose",
};

  private _downloadHandler?: DownloadHandler;
  private _folderDownloadHandler?: FolderDownloadHandler;

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
  }

  public handleDownloadFile(menu: Menu, editor: Editor): void {
    const links = this.getUploadedLinks(editor.getSelection());
    if (!links.length) return;

    menu.addItem((item: MenuItem) => {
      item.setTitle(t("download.menuTitle")).setIcon("download").onClick(() => {
        this.downloadHandler.handleDownloadFiles(this.createDownloadItems(links));
      });
    });
  }

  public addDownloadAllFilesMenu(menu: Menu, target: TFile | TFolder): void {
    menu.addItem((item: MenuItem) => {
      item.setTitle(t("download.allMenuTitle")).setIcon("download").onClick(async () => {
        const domain = this.configurationManager.getPublicDomain();
        const result: FolderActionResult & { downloadableFiles: DownloadableFile[] } = { 
          totalDocs: 0, 
          fileCount: 0, 
          downloadableFiles: [] 
        };
        
        const modal = new FolderActionModal(
          this.app,
          result,
          this.DOWNLOAD_CONFIG,
          async (onProgress) => {
            const urls = result.downloadableFiles.map((f: DownloadableFile) => f.url);
            const urlToLocalPath = await this.folderDownloadHandler.handleDownloadFiles(urls, onProgress);
            await this.replaceLinksInDocs(result.downloadableFiles, urlToLocalPath);
            return urlToLocalPath;
          }
        );
        modal.open();

        const scanResult = await scanFolderForDownloadableFiles(
          this.app,
          target,
          domain,
          (current, total) => modal.updateScanProgress(current, total)
        );
        
        result.totalDocs = scanResult.totalDocs;
        result.fileCount = scanResult.downloadableFiles.length;
        result.downloadableFiles = scanResult.downloadableFiles;
        
        modal.contentEl.empty();
        modal.onOpen();
      });
    });
  }

  public getQueueStatus() {
    return this._downloadHandler?.getQueueStatus();
  }

  public dispose(): void {
    this._downloadHandler?.dispose();
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

  private get folderDownloadHandler(): FolderDownloadHandler {
    if (!this._folderDownloadHandler) {
      this._folderDownloadHandler = new FolderDownloadHandler(
        this.app,
        this.configurationManager,
        this.storageServiceManager,
      );
    }
    return this._folderDownloadHandler;
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

  private async replaceLinksInDocs(downloadableFiles: DownloadableFile[], urlToLocalPath: Map<string, string>): Promise<void> {
    // Group by document
    const docReplacements = new Map<string, Array<{ url: string; localPath: string }>>();
    for (const { url, docPaths } of downloadableFiles) {
      const localPath = urlToLocalPath.get(url);
      if (localPath) {
        for (const docPath of docPaths) {
          if (!docReplacements.has(docPath)) {
            docReplacements.set(docPath, []);
          }
          docReplacements.get(docPath)!.push({ url, localPath });
        }
      }
    }

    // Apply replacements
    for (const [docPath, replacements] of docReplacements) {
      const file = this.app.vault.getAbstractFileByPath(docPath);
      if (file instanceof TFile) {
        let content = await this.app.vault.read(file);
        for (const { url, localPath } of replacements) {
          content = content.split(url).join(encodeURI(localPath));
        }
        await this.app.vault.modify(file, content);
      }
    }
  }
}
