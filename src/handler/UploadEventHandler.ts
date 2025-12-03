import { App, MarkdownView } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { ConfigurationManager } from "../manager/ConfigurationManager";
import { UploadServiceManager } from "../manager/UploaderManager";
import { isImageExtension, isFileTypeSupported, MULTIPART_UPLOAD_THRESHOLD } from "../utils/FileUtils";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { ConcurrencyController } from "../utils/ConcurrencyController";
import { ProgressDebouncer } from "../utils/ProgressDebouncer";

/**
 * Base class for upload event handlers (clipboard and drag-drop)
 * Handles file upload operations with progress tracking
 */
export class UploadEventHandler extends BaseEventHandler<string | File> {
  protected uploadServiceManager: UploadServiceManager;
  private concurrencyController: ConcurrencyController;
  private progressDebouncers: Map<string, ProgressDebouncer> = new Map();

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
  ) {
    super(app, configurationManager);
    this.uploadServiceManager = uploadServiceManager;
    this.concurrencyController = new ConcurrencyController(3); // Max 3 concurrent uploads
  }

  /**
   * Handle file upload event from clipboard or drag-drop
   * @param items - DataTransferItemList containing files
   */
  public async handleFileUploadEvent(
    items: DataTransferItemList,
  ): Promise<void> {
    const queue = await this.getFileQueue(items);
    logger.debug("BaseUploadEventHandler", "Files queued for upload", {
      queueLength: queue.length,
    });

    const queueWithPlaceholders = [];
    for (const item of queue) {
      if (item.type === "file" && item.value instanceof File) {
        const placeholder = this.insertUploadingPlaceholder(item.value);
        queueWithPlaceholders.push({ ...item, placeholder });
      } else {
        queueWithPlaceholders.push(item);
      }
    }

    void this.addToProcessingQueue(queueWithPlaceholders);
  }

  /**
   * Process a single upload item (file or text)
   * @param item - Item containing type and value
   */
  protected async processItem(
    item: {
      type: string;
      value: string | File;
      placeholder?: { id: string };
    },
    _index?: number,
  ): Promise<void> {
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        logger.warn("BaseUploadEventHandler", "No active markdown view");
        return;
      }

      if (item.type === "text" && typeof item.value === "string") {
        logger.debug("BaseUploadEventHandler", "Processing text item");
        activeView.editor.replaceSelection(item.value);
        return;
      }

      if (item.type === "file" && item.value instanceof File) {
        const file = item.value;
        const extension = file.name.split(".").pop()?.toLowerCase();

        logger.debug("BaseUploadEventHandler", "Processing file item", {
          fileName: file.name,
          fileSize: file.size,
          extension,
        });

        const placeholderPosition = item.placeholder!;
        const supportedTypes = this.configurationManager.getSettings().autoUploadFileTypes;
        if (!isFileTypeSupported(supportedTypes,extension)) {
          await this.processNotSupportedFile(file, placeholderPosition);
          return;
        }

        // Create debouncer for this upload
        const debouncer = new ProgressDebouncer(100);
        this.progressDebouncers.set(placeholderPosition.id, debouncer);

        // Use concurrency controller to limit parallel uploads
        const result = await this.concurrencyController.run(async () => {
          return await this.uploadServiceManager.uploadFile(
            file,
            undefined,
            (progress) => {
              debouncer.update(progress, (debouncedProgress) => {
                this.updateUploadProgress(
                  placeholderPosition,
                  file.name,
                  debouncedProgress,
                );
              });
            },
          );
        });

        // Clean up debouncer
        debouncer.clear();
        this.progressDebouncers.delete(placeholderPosition.id);

        if (result.success && result.url) {
          logger.debug(
            "BaseUploadEventHandler",
            "File processed successfully",
            {
              fileName: file.name,
            },
          );
          this.replacePlaceholderWithLink(
            placeholderPosition,
            result.url,
            file.name,
          );
        } else {
          const errorMsg = result.error || t("error.uploadFailed");
          logger.error("BaseUploadEventHandler", "File processing failed", {
            fileName: file.name,
            error: errorMsg,
          });
          this.replacePlaceholderWithError(
            placeholderPosition,
            file.name,
            errorMsg,
          );
        }
      }
    } catch (error) {
      logger.error(
        "BaseUploadEventHandler",
        "Error processing drag drop file",
        error,
      );
    }
  }

  /**
   * Insert uploading placeholder in editor
   * @param file - File being uploaded
   * @returns Upload ID for updating placeholder
   */
  protected insertUploadingPlaceholder(file: File): { id: string } {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) {
      return { id: "" };
    }

    const editor = activeView.editor;
    const cursor = editor.getCursor();
    const uploadId = `u${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;

    const fileName = file.name;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const supportedTypes = this.configurationManager.getSettings().autoUploadFileTypes;

    let placeholderText = "";
    if (!isFileTypeSupported(supportedTypes,extension) || file.size <= MULTIPART_UPLOAD_THRESHOLD) {
      placeholderText = `⏳${t("upload.progressing")} ${fileName}...<!--${uploadId}-->\n`;
    } else {
      placeholderText = `📤(0%) ${t("upload.uploading")} ${fileName}...<!--${uploadId}-->\n`;
    }

    editor.replaceRange(placeholderText, cursor);
    editor.setCursor({ line: cursor.line + 1, ch: 0 });

    return { id: uploadId };
  }

  /**
   * Update upload progress in editor
   * @param position - Contains upload ID
   * @param fileName - Name of file being uploaded
   * @param progress - Upload progress percentage (0-100)
   */
  protected updateUploadProgress(
    position: { id: string },
    fileName: string,
    progress: number,
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${position.id}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      return;
    }

    const progressText = `📤(${Math.round(progress)}%) ${t("upload.uploading")} ${fileName}...${marker}`;
    const lineEndIndex = content.indexOf('\n', markerIndex);
    const endIndex = lineEndIndex === -1 ? content.length : lineEndIndex;

    const lineStartIndex = content.lastIndexOf('\n', markerIndex - 1) + 1;
    const textBeforePlaceholder = content.substring(lineStartIndex, markerIndex);
    
    // Find where the placeholder actually starts (look for emoji or progress indicator)
    const placeholderStart = textBeforePlaceholder.search(/[\u231B\uD83D\uDCE4]/);
    const prefixText = placeholderStart !== -1 ? textBeforePlaceholder.substring(0, placeholderStart) : '';
    
    const beforeContent = content.substring(0, lineStartIndex);
    const afterMarker = content.substring(endIndex);

    editor.setValue(beforeContent + prefixText + progressText + afterMarker);
  }

  /**
   * Replace placeholder with markdown link after successful upload
   * @param position - Contains upload ID
   * @param url - Uploaded file URL
   * @param fileName - Name of uploaded file
   */
  protected replacePlaceholderWithLink(
    position: { id: string },
    url: string,
    fileName: string,
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) {
      return;
    }

    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const markdown = this.generateMarkdownLink(extension, fileName, url);

    this.replacePlaceholderById(position.id, markdown);
  }

  /**
   * Generate appropriate markdown link based on file type
   */
  private generateMarkdownLink(
    extension: string,
    fileName: string,
    url: string,
  ): string {
    const encodedUrl = encodeURI(url);
    return isImageExtension(extension)
      ? `![${fileName}](${encodedUrl})`
      : `[${fileName}](${encodedUrl})`;
  }

  /**
   * Replace placeholder with text
   * @param position - Contains upload ID
   * @param text - Text to replace with
   */
  protected replacePlaceholderWithText(
    position: { id: string },
    text: string,
  ): void {
    this.replacePlaceholderById(position.id, text);
  }

  /**
   * Replace placeholder with error message on upload failure
   * @param position - Contains upload ID
   * @param fileName - Name of file that failed to upload
   * @param errorMessage - Optional specific error message
   */
  protected replacePlaceholderWithError(
    position: { id: string },
    fileName: string,
    errorMessage?: string,
  ): void {
    let pre = "";
    const supportedTypes = this.configurationManager.getSettings().autoUploadFileTypes;
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (!isFileTypeSupported(supportedTypes, extension)) {
      pre = t("upload.progrefailed");
    } else {
      pre = t("upload.failed");
    }
    const errorText = errorMessage
      ? `❌ ${pre} ${fileName}: ${errorMessage}`
      : `❌ ${pre} ${fileName}`;
    this.replacePlaceholderWithText(position, errorText);
  }

  /**
   * Replace placeholder by upload ID
   * @param uploadId - Unique upload identifier
   * @param text - Text to replace with
   */
  private replacePlaceholderById(uploadId: string, text: string): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${uploadId}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      return;
    }

    const lineEndIndex = content.indexOf('\n', markerIndex);
    const endIndex = lineEndIndex === -1 ? content.length : lineEndIndex;

    const lineStartIndex = content.lastIndexOf('\n', markerIndex - 1) + 1;
    const textBeforePlaceholder = content.substring(lineStartIndex, markerIndex);
    
    // Find where the placeholder actually starts (look for emoji or progress indicator)
    const placeholderStart = textBeforePlaceholder.search(/[\u231B\uD83D\uDCE4\u274C]/);
    const prefixText = placeholderStart !== -1 ? textBeforePlaceholder.substring(0, placeholderStart) : '';
    
    const beforeContent = content.substring(0, lineStartIndex);
    const afterMarker = content.substring(endIndex);

    editor.setValue(beforeContent + prefixText + text + afterMarker);
  }


  /**
   * Get unique file name in specific folder by adding suffix if file already exists
   * @param fileName - Original file name
   * @param folderPath - Folder path to check
   * @returns Unique file name
   */
  private getUniqueFileNameInFolder(
    fileName: string,
    folderPath: string,
  ): string {
    const fullPath = `${folderPath}/${fileName}`;
    const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
    if (!existingFile) {
      return fileName;
    }

    const dotIndex = fileName.lastIndexOf(".");
    const name = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    const ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";

    let counter = 1;
    let uniqueName = `${name}-${counter}${ext}`;
    while (
      this.app.vault.getAbstractFileByPath(`${folderPath}/${uniqueName}`)
    ) {
      counter++;
      uniqueName = `${name}-${counter}${ext}`;
    }

    return uniqueName;
  }

  private async processNotSupportedFile(
    file: File,
    placeholder: { id: string },
  ) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    logger.debug(
      "BaseUploadEventHandler",
      "File type not supported for upload, saving to vault",
      { extension },
    );

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      logger.warn(
        "BaseUploadEventHandler",
        "File type not supported:No active markdown view",
      );
      return;
    }

    try {
      const vault = this.app.vault as unknown as {
        config?: { attachmentFolderPath?: string };
        adapter: { exists: (path: string) => Promise<boolean> };
      };
      const currentFolder = activeView.file?.parent?.path || "";
      let attachmentFolder = vault.config?.attachmentFolderPath || "./";

      if (attachmentFolder.startsWith("./")) {
        attachmentFolder = currentFolder
          ? `${currentFolder}/${attachmentFolder.slice(2)}`
          : attachmentFolder.slice(2);
      }

      if (!(await vault.adapter.exists(attachmentFolder))) {
        await this.app.vault.createFolder(attachmentFolder);
      }

      const uniqueName = this.getUniqueFileNameInFolder(
        file.name,
        attachmentFolder,
      );
      const fullPath = `${attachmentFolder}/${uniqueName}`;
      const created = await this.app.vault.createBinary(
        fullPath,
        await file.arrayBuffer(),
      );

      this.replacePlaceholderWithText(
        placeholder,
        `[${file.name}](${created.path})`,
      );
    } catch (error: unknown) {
      logger.error("BaseUploadEventHandler", "Failed to save file to vault", {
        fileName: file.name,
        error,
      });
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.replacePlaceholderWithError(placeholder, file.name, errorMsg);
    }
  }

  /**
   * Extract files and text from DataTransferItemList
   * @param items - DataTransferItemList from event
   * @returns Queue of items to process
   */
  protected async getFileQueue(
    items: DataTransferItemList,
  ): Promise<Array<{ type: string; value: string | File }>> {
    const queue: Array<{ type: string; value: string | File }> = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "string" && item.type === "text/plain") {
        const text = await new Promise<string>((resolve) =>
          item.getAsString(resolve),
        );
        queue.push({ type: "text", value: text });
        continue;
      }
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry?.isDirectory) {
          logger.debug("UploadEventHandler", "Detected directory drop", {
            name: entry.name,
          });
          continue;
        }
        const file = item.getAsFile();
        if (!file) {
          continue;
        }
        queue.push({ type: "file", value: file });
      }
    }
    return queue;
  }
}
