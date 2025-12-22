import { App, Menu, MenuItem, Editor, TFile, TFolder } from "obsidian";
import { DownloadHandler } from "./providers/DownloadHandler";
import { FolderDownloadHandler } from "./providers/FolderDownloadHandler";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { StorageServiceManager } from "../storage/StorageServiceManager";
import { FolderActionModal } from "../components/FolderActionModal";
import { EventType, DownloadProcessItem } from "../types/index";
import {
  findUploadedFileLinks,
  scanFolderForDownloadableFiles,
  DownloadableFile,
} from "../common/MarkdownLinkFinder";
import { generateUniqueId } from "../common/FileUtils";
import { t } from "../i18n";

interface DownloadActionResult {
  totalDocs: number;
  fileCount: number;
  downloadableFiles: DownloadableFile[];
}

export class DownloadHandlerManager {
  private app: App;
  private configurationManager: ConfigurationManager;
  private storageServiceManager: StorageServiceManager;

  private downloadHandler: DownloadHandler;
  private folderDownloadHandler: FolderDownloadHandler;

  private readonly DOWNLOAD_CONFIG = {
    titleKey: "modal.download.title",
    resultKey: "modal.download.result",
    scanningKey: "modal.download.scanning",
    actionBtnKey: "modal.download.actionBtn",
    progressKey: "modal.download.progress",
    closeKey: "modal.download.close",
  };

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.storageServiceManager = storageServiceManager;

    this.downloadHandler = new DownloadHandler(
      app,
      configurationManager,
      storageServiceManager,
    );

    this.folderDownloadHandler = new FolderDownloadHandler(
      app,
      configurationManager,
      storageServiceManager,
    );
  }

  public handleDownloadFile(menu: Menu, editor: Editor): void {
    const selection = editor.getSelection();
    if (!selection) {
      return;
    }

    const domain = this.configurationManager.getPublicDomain();
    const links = findUploadedFileLinks(selection, domain) || [];
    if (!links.length) {
      return;
    }

    const processItems: DownloadProcessItem[] = links.map((url) => ({
      id: generateUniqueId("dl"),
      eventType: EventType.DOWNLOAD,
      type: "download",
      url: url,
    }));

    menu.addItem((item: MenuItem) => {
      item
        .setTitle(t("download.menuTitle"))
        .setIcon("download")
        .onClick(() => {
          this.downloadHandler.handleDownloadFiles(processItems);
        });
    });
  }

  public handleDownloadMenu(menu: Menu, target: TFile | TFolder): void {
    if (target instanceof TFile && target.extension !== "md") {
      return;
    }

    menu.addItem((item: MenuItem) => {
      item
        .setTitle(t("download.allFiles"))
        .setIcon("download")
        .onClick(async () => {
          const domain = this.configurationManager.getPublicDomain();
          const scanResult = await scanFolderForDownloadableFiles(
            this.app,
            target,
            domain,
          );

          if (scanResult.downloadableFiles.length === 0) {
            return;
          }

          // Create compatible result object
          const result: DownloadActionResult = {
            totalDocs: scanResult.totalDocs,
            fileCount: scanResult.downloadableFiles.length,
            downloadableFiles: scanResult.downloadableFiles,
          };

          const modal = new FolderActionModal(
            this.app,
            result,
            this.DOWNLOAD_CONFIG,
            async (onProgress) => {
              // Convert downloadable files to process items
              const processItems: DownloadProcessItem[] =
                result.downloadableFiles.map((file: DownloadableFile) => ({
                  id: generateUniqueId("dl"),
                  eventType: EventType.DOWNLOAD,
                  type: "download",
                  url: file.url,
                }));

              // Process downloads with progress callback
              await this.folderDownloadHandler.handleDownloadFiles(
                processItems,
                (current, total, filename) => onProgress(current, total),
              );

              // Replace links in documents
              await this.replaceLinksInDocs(result.downloadableFiles);
              return true;
            },
          );
          modal.open();

          modal.contentEl.empty();
          modal.onOpen();
        });
    });
  }

  public getQueueStatus() {
    return this.downloadHandler.getQueueStatus();
  }

  public dispose(): void {
    this.downloadHandler.dispose();
  }

  private async replaceLinksInDocs(
    downloadableFiles: DownloadableFile[],
  ): Promise<void> {
    // Group by document
    const docReplacements = new Map<
      string,
      Array<{ url: string; localPath: string }>
    >();
    for (const { url, docPaths } of downloadableFiles) {
      // In the new approach, we need to determine the local path somehow
      // For now, we'll skip this replacement since it's handled differently
      // TODO: Implement proper link replacement logic
      continue;
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
