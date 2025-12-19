import { App, TFile, normalizePath } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { generateUniqueId, generateFileKey } from "../../common/FileUtils";
import { logger } from "../../common/Logger";
import { BaseEventHandler } from "./BaseHandler";
import { ProcessItem } from "../../types/index";
import { UploadableFile } from "../../common/MarkdownLinkFinder";

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
 * Handles batch file upload operations for folders
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
    // Not used directly - upload logic is in handleUploadFiles
  }

  /**
   * Upload files and replace links in documents
   * Process documents sequentially, files within each document sequentially
   */
  public async handleUploadFiles(
    files: UploadableFile[],
    onProgress: (current: number, total: number) => void,
  ): Promise<void> {
    let uploadedCount = 0;
    const totalFiles = files.length;
    const uploadingPromises = new Map<string, Promise<string | null>>();

    // Helper to upload a file with deduplication
    const uploadFile = async (
      filePath: string,
      docPath: string,
    ): Promise<string | null> => {
      const decodedPath = normalizeFilePath(filePath);

      // Check if already uploading
      if (uploadingPromises.has(decodedPath)) {
        return uploadingPromises.get(decodedPath)!;
      }

      // Start upload
      const uploadPromise = (async () => {
        try {
          const tfile = this.app.metadataCache.getFirstLinkpathDest(
            decodedPath,
            docPath,
          );
          let file: File;
          if (tfile instanceof TFile) {
            const arrayBuffer = await this.app.vault.readBinary(tfile);
            file = new File([new Blob([arrayBuffer])], tfile.name);
          } else {
            const arrayBuffer =
              await this.app.vault.adapter.readBinary(decodedPath);
            file = new File(
              [new Blob([arrayBuffer])],
              decodedPath.split("/").pop() || "file",
            );
          }

          const id = generateUniqueId("u", file);
          const key = generateFileKey(file.name, id);
          const result = await this.storageServiceManager.uploadFile(file, key);

          const url = result.success && result.data ? result.data.url : null;
          if (!url) {
            logger.warn("FolderUploadHandler", "Upload returned no URL", {
              filePath,
              success: result.success,
              hasData: !!result.data,
              dataUrl: result.data?.url,
            });
          }
          return url;
        } catch (error) {
          logger.error("FolderUploadHandler", "Failed to upload file", {
            filePath,
            error,
          });
          return null;
        }
      })();

      uploadingPromises.set(decodedPath, uploadPromise);
      return uploadPromise;
    };

    // Upload files and collect results
    const uploadResults: Array<{
      filePath: string;
      url: string | null;
      docPaths: string[];
    }> = [];

    for (const { filePath, docPaths } of files) {
      const url = await uploadFile(filePath, docPaths[0]);
      uploadResults.push({ filePath, url, docPaths });
      uploadedCount++;
      onProgress(uploadedCount, totalFiles);
    }

    // Group successful results by document for replacement
    const docReplacements = new Map<
      string,
      Array<{ filePath: string; url: string }>
    >();
    for (const { filePath, url, docPaths } of uploadResults) {
      if (url) {
        for (const docPath of docPaths) {
          if (!docReplacements.has(docPath)) {
            docReplacements.set(docPath, []);
          }
          docReplacements.get(docPath)!.push({ filePath, url });
        }
      }
    }

    // Apply replacements to all documents
    for (const [docPath, replacements] of docReplacements) {
      const docFile = this.app.vault.getAbstractFileByPath(docPath);
      if (docFile instanceof TFile) {
        let content = await this.app.vault.read(docFile);
        for (const { filePath, url } of replacements) {
          const pathVariants = [filePath];
          try {
            const decoded = decodeURIComponent(filePath);
            if (decoded !== filePath) {
              pathVariants.push(decoded);
            }
          } catch {
            /* ignore */
          }
          try {
            const encoded = encodeURI(filePath);
            if (encoded !== filePath) {
              pathVariants.push(encoded);
            }
          } catch {
            /* ignore */
          }

          for (const path of pathVariants) {
            const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const mdPattern = `(!\\[[^\\]]*\\]\\()${escaped}(\\))`;
            const wikiPattern = `(!\\[\\[)${escaped}(\\]\\])`;

            const newContent = content
              .replace(new RegExp(mdPattern, "g"), `$1${url}$2`)
              .replace(new RegExp(wikiPattern, "g"), url);

            if (newContent !== content) {
              content = newContent;
              break;
            }
          }
        }
        await this.app.vault.modify(docFile, content);
      }
    }
  }
}
