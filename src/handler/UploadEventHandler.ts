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
    items: Array<ProcessItem>,
  ): Promise<void> {
    logger.debug("BaseUploadEventHandler", "Files queued for upload", {
      itemsLength: items.length,
    });

    for (const processItem of items) {
      if (processItem.type === "file" && processItem.value instanceof File) {
        if (processItem.localPath) {
          this.replaceLocalLinkWithPlaceholder(processItem);
        } else {
          this.insertUploadingPlaceholder(processItem);
        }
      }
    }

    void this.processItems(items);
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
      placeholderText = `[${fileName}]⏳${t("upload.progressing")}<!--${processItem.id}-->\n`;
    } else {
      placeholderText = `[${fileName}]📤(0%)${t("upload.uploading")}<!--${processItem.id}-->\n`;
    }

    editor.replaceRange(placeholderText, cursor);
    editor.setCursor({ line: cursor.line + 1, ch: 0 });
  }

  protected replaceLocalLinkWithPlaceholder(processItem: ProcessItem) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.editor) {
      return;
    }

    const file = processItem.value as File;
    const editor = activeView.editor;
    const content = editor.getValue();
    const localPath = processItem.localPath!;
    const extension = processItem.extension;
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();

    // 匹配 [文件名](本地路径) 格式，替换括号内容为占位符
    const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`(!?\\[[^\\]]*\\])\\(${escapedPath}\\)`, "g");
    
    let placeholder = "";
    if (!isFileTypeSupported(supportedTypes, extension) || file.size <= MULTIPART_UPLOAD_THRESHOLD) {
      placeholder = `$1⏳${t("upload.progressing")}<!--${processItem.id}-->`;
    } else {
      placeholder = `$1📤(0%)${t("upload.uploading")}<!--${processItem.id}-->`;
    }

    const updatedContent = content.replace(linkRegex, placeholder);
    editor.setValue(updatedContent);
  }
}
