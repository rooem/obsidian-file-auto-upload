import { App, TFile, TFolder, normalizePath } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { FolderScanModal, FolderScanResult } from "../../components/FolderScanModal";
import { findSupportedFilePath } from "../../common/MarkdownLinkFinder";
import { generateUniqueId, generateFileKey } from "../../common/FileUtils";
import { logger } from "../../common/Logger";
import { BaseEventHandler } from "./BaseEventHandler";
import { ProcessItem } from "../../types/index";

/**
 * Handles folder scanning and batch file upload operations
 */
export class FolderUploadHandler extends BaseEventHandler {
  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
    maxConcurrent: number = 3,
  ) {
    super(app, configurationManager, storageServiceManager, maxConcurrent);
  }

  protected async processItem(_processItem: ProcessItem): Promise<void> {
    // Not used for folder upload, implemented for abstract requirement
  }

  /**
   * Scan folder for uploadable files and show modal
   */
  public async scanAndShowFolderFiles(folder: TFolder): Promise<void> {
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    const result: FolderScanResult = { totalDocs: 0, uploadableFiles: [] };

    const allFiles: TFile[] = [];
    const collectFiles = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFolder) {
          collectFiles(child);
        } else if (child instanceof TFile && child.extension === "md") {
          allFiles.push(child);
        }
      }
    };
    collectFiles(folder);

    const modal = new FolderScanModal(
      this.app,
      result,
      (onProgress) => this.uploadFolderFiles(result.uploadableFiles, onProgress)
    );
    modal.open();

    for (let i = 0; i < allFiles.length; i++) {
      const child = allFiles[i];
      result.totalDocs++;
      modal.updateScanProgress(i + 1, allFiles.length);
      const content = await this.app.vault.read(child);
      const localFiles = findSupportedFilePath(content, supportedTypes);
      localFiles.forEach((filePath) => {
        result.uploadableFiles.push({ filePath, docPath: child.path });
      });
    }

    modal.contentEl.empty();
    modal.onOpen();
  }

  private async uploadFolderFiles(
    files: Array<{ filePath: string; docPath: string }>,
    onProgress: (current: number, total: number) => void
  ): Promise<void> {
    const filesByDoc = new Map<string, Array<{ filePath: string; file: File }>>();

    for (const { filePath, docPath } of files) {
      try {
        const decodedPath = normalizePath(decodeURIComponent(filePath));
        const tfile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, docPath);
        let arrayBuffer: ArrayBuffer;
        let file: File;
        if (tfile instanceof TFile) {
          arrayBuffer = await this.app.vault.readBinary(tfile);
          file = new File([new Blob([arrayBuffer])], tfile.name);
        } else {
          arrayBuffer = await this.app.vault.adapter.readBinary(decodedPath);
          file = new File([new Blob([arrayBuffer])], decodedPath.split("/").pop() || "file");
        }

        if (!filesByDoc.has(docPath)) {
          filesByDoc.set(docPath, []);
        }
        filesByDoc.get(docPath)!.push({ filePath, file });
      } catch (error) {
        logger.error("FolderUploadHandler", "Failed to read file", { filePath, error });
      }
    }

    let uploadedCount = 0;
    const totalFiles = files.length;

    for (const [docPath, docFiles] of filesByDoc) {
      const docFile = this.app.vault.getAbstractFileByPath(docPath);
      if (!(docFile instanceof TFile)) continue;

      const replacements: Array<{ localPath: string; url: string }> = [];

      const uploadPromises = docFiles.map(({ filePath, file }) =>
        this.concurrencyController.run(async () => {
          const uploadResult = await this.uploadSingleFile(file);
          uploadedCount++;
          onProgress(uploadedCount, totalFiles);
          if (uploadResult) {
            replacements.push({ localPath: filePath, url: uploadResult });
          }
        })
      );
      await Promise.all(uploadPromises);

      if (replacements.length > 0) {
        let content = await this.app.vault.read(docFile);
        for (const { localPath, url } of replacements) {
          content = content.split(localPath).join(url);
        }
        await this.app.vault.modify(docFile, content);
      }
    }
  }

  private async uploadSingleFile(file: File): Promise<string | null> {
    const id = generateUniqueId("u", file);

    try {
      const key = generateFileKey(file.name, id);
      const result = await this.storageServiceManager.uploadFile(file, key);

      if (result.success && result.data) {
        return result.data.url;
      }
      return null;
    } catch {
      return null;
    }
  }
}
