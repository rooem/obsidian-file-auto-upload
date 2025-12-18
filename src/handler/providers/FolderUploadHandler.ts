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
 * Normalize and decode file path safely
 */
function normalizeFilePath(filePath: string): string {
  try {
    return normalizePath(decodeURIComponent(filePath));
  } catch {
    return normalizePath(filePath);
  }
}

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
    // Not used - upload logic is in uploadFolderFiles
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
    let uploadedCount = 0;
    const totalFiles = files.length;

    // Group files by document
    const filesByDoc = new Map<string, Array<{ filePath: string; docPath: string }>>();
    for (const item of files) {
      if (!filesByDoc.has(item.docPath)) {
        filesByDoc.set(item.docPath, []);
      }
      filesByDoc.get(item.docPath)!.push(item);
    }

    // Process each document sequentially to avoid concurrent modification
    for (const [docPath, docFiles] of filesByDoc) {
      // Upload files concurrently using concurrencyController
      const uploadPromises = docFiles.map(({ filePath }) =>
        this.concurrencyController.run(async () => {
          try {
            const decodedPath = normalizeFilePath(filePath);
            const tfile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, docPath);
            let file: File;
            if (tfile instanceof TFile) {
              const arrayBuffer = await this.app.vault.readBinary(tfile);
              file = new File([new Blob([arrayBuffer])], tfile.name);
            } else {
              const arrayBuffer = await this.app.vault.adapter.readBinary(decodedPath);
              file = new File([new Blob([arrayBuffer])], decodedPath.split("/").pop() || "file");
            }

            const id = generateUniqueId("u", file);
            const key = generateFileKey(file.name, id);
            const result = await this.storageServiceManager.uploadFile(file, key);

            uploadedCount++;
            onProgress(uploadedCount, totalFiles);

            return {
              filePath,
              url: result.success && result.data ? result.data.url : null,
            };
          } catch (error) {
            uploadedCount++;
            onProgress(uploadedCount, totalFiles);
            logger.error("FolderUploadHandler", "Failed to upload file", { filePath, error });
            return { filePath, url: null };
          }
        })
      );

      const results = await Promise.all(uploadPromises);

      // Apply all replacements for this document
      const successfulResults = results.filter((r) => r.url !== null);
      if (successfulResults.length > 0) {
        const docFile = this.app.vault.getAbstractFileByPath(docPath);
        if (docFile instanceof TFile) {
          let content = await this.app.vault.read(docFile);
          for (const { filePath, url } of successfulResults) {
            // Try both encoded and decoded versions for replacement
            content = content.split(filePath).join(url!);
            try {
              const decoded = decodeURIComponent(filePath);
              if (decoded !== filePath) {
                content = content.split(decoded).join(url!);
              }
            } catch {
              // Ignore decode errors
            }
          }
          await this.app.vault.modify(docFile, content);
        }
      }
    }
  }
}
