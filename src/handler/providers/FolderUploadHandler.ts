import { App, TFile, normalizePath } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { generateUniqueId, generateFileKey } from "../../common/FileUtils";
import { logger } from "../../common/Logger";
import { BaseEventHandler } from "./BaseEventHandler";
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
    onProgress: (current: number, total: number) => void
  ): Promise<void> {
    let uploadedCount = 0;
    const totalFiles = files.length;

    // Cache for uploaded files: normalizedPath -> url (to avoid duplicate uploads)
    const uploadedCache = new Map<string, string | null>();
    const uploadingPromises = new Map<string, Promise<string | null>>();

    // Helper to upload a file with deduplication
    const uploadFile = async (filePath: string, docPath: string): Promise<string | null> => {
      const decodedPath = normalizeFilePath(filePath);
      
      // Check cache first
      if (uploadedCache.has(decodedPath)) {
        return uploadedCache.get(decodedPath)!;
      }
      
      // Check if already uploading
      if (uploadingPromises.has(decodedPath)) {
        return uploadingPromises.get(decodedPath)!;
      }

      // Start upload
      const uploadPromise = (async () => {
        try {
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

          const url = result.success && result.data ? result.data.url : null;
          if (!url) {
            logger.warn("FolderUploadHandler", "Upload returned no URL", { 
              filePath, 
              success: result.success, 
              hasData: !!result.data,
              dataUrl: result.data?.url 
            });
          }
          uploadedCache.set(decodedPath, url);
          return url;
        } catch (error) {
          logger.error("FolderUploadHandler", "Failed to upload file", { filePath, error });
          uploadedCache.set(decodedPath, null);
          return null;
        }
      })();

      uploadingPromises.set(decodedPath, uploadPromise);
      return uploadPromise;
    };

    // Group files by document
    const filesByDoc = new Map<string, UploadableFile[]>();
    for (const item of files) {
      if (!filesByDoc.has(item.docPath)) {
        filesByDoc.set(item.docPath, []);
      }
      filesByDoc.get(item.docPath)!.push(item);
    }

    // Process documents concurrently, files within each document sequentially
    const docPromises = Array.from(filesByDoc.entries()).map(([docPath, docFiles]) =>
      this.concurrencyController.run(async () => {
        const results: Array<{ filePath: string; url: string | null }> = [];

        // Upload files sequentially within each document
        for (const { filePath } of docFiles) {
          const url = await uploadFile(filePath, docPath);
          results.push({ filePath, url });
          uploadedCount++;
          onProgress(uploadedCount, totalFiles);
        }

        // Apply replacements immediately after all files in this document are uploaded
        const successfulResults = results.filter((r) => r.url !== null);
        if (successfulResults.length > 0) {
          const docFile = this.app.vault.getAbstractFileByPath(docPath);
          if (docFile instanceof TFile) {
            let content = await this.app.vault.read(docFile);
            for (const { filePath, url } of successfulResults) {
              const pathVariants = [filePath];
              try {
                const decoded = decodeURIComponent(filePath);
                if (decoded !== filePath) pathVariants.push(decoded);
              } catch { /* ignore */ }
              try {
                const encoded = encodeURI(filePath);
                if (encoded !== filePath) pathVariants.push(encoded);
              } catch { /* ignore */ }

              let replaced = false;
              for (const path of pathVariants) {
                const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                // Match Markdown link: ![...](path) or Wiki link: ![[path]]
                const mdPattern = `(!\\[[^\\]]*\\]\\()${escaped}(\\))`;
                const wikiPattern = `(!\\[\\[)${escaped}(\\]\\])`;
                
                const newContent = content
                  .replace(new RegExp(mdPattern, "g"), `$1${url}$2`)
                  .replace(new RegExp(wikiPattern, "g"), url!);
                
                if (newContent !== content) {
                  content = newContent;
                  replaced = true;
                  break;
                }
              }
              if (!replaced) {
                logger.warn("FolderUploadHandler", "Link not found in content", { filePath, docPath });
              }
            }
            await this.app.vault.modify(docFile, content);
          }
        }
      })
    );

    await Promise.all(docPromises);
  }
}
