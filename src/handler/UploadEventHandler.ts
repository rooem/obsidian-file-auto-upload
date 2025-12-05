import { App, MarkdownView } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { isFileTypeSupported, MULTIPART_UPLOAD_THRESHOLD } from "../utils/FileUtils";
import { t } from "../i18n";
import { logger } from "../utils/Logger";
import { EventType, ProcessItem } from "../types/index";
import { TextItemProcessor } from "./processors/TextItemProcessor";
import { FileItemProcessor } from "./processors/FileItemProcessor";

/**
 * Base class for upload event handlers (clipboard and drag-drop)
 * Handles file upload operations with progress tracking
 */
export class UploadEventHandler extends BaseEventHandler<string | File> {
  protected uploadServiceManager: UploadServiceManager;
  private textItemProcessor: TextItemProcessor;
  private fileItemProcessor: FileItemProcessor;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
  ) {
    super(app, configurationManager, 3);
    this.uploadServiceManager = uploadServiceManager;
    this.textItemProcessor = new TextItemProcessor();
    this.fileItemProcessor = new FileItemProcessor(
      app,
      configurationManager,
      uploadServiceManager
    );
  }

  /**
   * Handle file upload event from clipboard, drag-drop, or local files
   * @param items - DataTransferItemList or array of local file paths with metadata
   */
  public async handleFileUploadEvent(
    items: DataTransferItemList | Array<{ file: File; localPath?: string }>,
  ): Promise<void> {
    const queue = await this.getFileQueue(items);
    logger.debug("BaseUploadEventHandler", "Files queued for upload", {
      queueLength: queue.length,
    });

    for (const processItem of queue) {
      if (processItem.type === "file" && processItem.value instanceof File) {
        this.insertUploadingPlaceholder(processItem);
      }
    }

    void this.processItems(queue);
  }

  /**
   * Process a single upload item (file or text)
   */
  protected async processItem(processItem: ProcessItem): Promise<void> {
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        logger.warn("BaseUploadEventHandler", "No active markdown view");
        return;
      }

      if (processItem.type === "text") {
        this.textItemProcessor.process(processItem, activeView);
      } else if (processItem.type === "file") {
        await this.fileItemProcessor.process(processItem);
      }
    } catch (error) {
      logger.error("BaseUploadEventHandler", "Error processing item", error);
    }
  }


  protected insertUploadingPlaceholder(processItem: ProcessItem) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) {
      return;
    }

    const file = processItem.value as File;
    const editor = activeView.editor;
    const cursor = editor.getCursor();
    const fileName = file.name;
    const extension = processItem.extension;
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();

    let placeholderText = "";
    if (!isFileTypeSupported(supportedTypes, extension) || file.size <= MULTIPART_UPLOAD_THRESHOLD) {
      placeholderText = `⏳${t("upload.progressing")} ${fileName}<!--${processItem.id}-->\n`;
    } else {
      placeholderText = `📤(0%)${t("upload.uploading")} ${fileName}<!--${processItem.id}-->\n`;
    }

    editor.replaceRange(placeholderText, cursor);
    editor.setCursor({ line: cursor.line + 1, ch: 0 });
  }

  /**
   * Extract files and text from DataTransferItemList or local file array
   * @param items - DataTransferItemList from event or array of local files
   * @returns Queue of items to process
   */
  protected async getFileQueue(
    items: DataTransferItemList | Array<{ file: File; localPath?: string }>,
  ): Promise<Array<ProcessItem>> {
    const queue: Array<ProcessItem> = [];
    
    // Handle local file array
    if (Array.isArray(items)) {
      for (const item of items) {
        const uploadId = `u${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
        queue.push({ 
          id: uploadId, 
          eventType: EventType.UPLOAD, 
          type: "file", 
          value: item.file, 
          extension: item.file.name.split(".").pop()?.toLowerCase(),
          localPath: item.localPath
        });
      }
      return queue;
    }
    
    // Handle DataTransferItemList
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const uploadId = `u${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
      if (item.kind === "string" && item.type === "text/plain") {
        const text = await new Promise<string>((resolve) =>
          item.getAsString(resolve),
        );
        queue.push({ id: uploadId, eventType: EventType.UPLOAD, type: "text", value: text });
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
        queue.push({ id: uploadId, eventType: EventType.UPLOAD, type: "file", value: file, extension: file.name.split(".").pop()?.toLowerCase() });
      }
    }
    return queue;
  }
}
