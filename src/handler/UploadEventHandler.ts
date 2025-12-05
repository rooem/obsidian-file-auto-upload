import { App, MarkdownView } from "obsidian";
import { BaseEventHandler } from "./BaseEventHandler";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { UploadServiceManager } from "../uploader/UploaderManager";
import { logger } from "../utils/Logger";
import { ProcessItem, TextProcessItem, FileProcessItem } from "../types/index";
import { isFileTypeSupported, isImageExtension, MULTIPART_UPLOAD_THRESHOLD } from "../utils/FileUtils";
import { t } from "../i18n";
import { ProgressDebouncer } from "../utils/ProgressDebouncer";

/**
 * Handles file upload operations with progress tracking
 */
export class UploadEventHandler extends BaseEventHandler {
  protected uploadServiceManager: UploadServiceManager;
  private progressDebouncers: Map<string, ProgressDebouncer> = new Map();

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    uploadServiceManager: UploadServiceManager,
  ) {
    super(app, configurationManager, 3);
    this.uploadServiceManager = uploadServiceManager;
  }

  public handleFileUploadEvent(items: ProcessItem[]): void {
    logger.debug("UploadEventHandler", "Files queued for upload", {
      itemsLength: items.length,
    });

    for (const processItem of items) {
      if (processItem.type === "file") {
        if (processItem.localPath) {
          this.replaceLocalLinkWithPlaceholder(processItem);
        } else {
          this.insertPlaceholder(processItem);
        }
      }
    }

    void this.processItems(items);
  }

  protected async processItem(processItem: ProcessItem): Promise<void> {
    try {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        logger.warn("UploadEventHandler", "No active markdown view");
        return;
      }

      if (processItem.type === "text") {
        activeView.editor.replaceSelection((processItem as TextProcessItem).value);
      } else if (processItem.type === "file") {
        await this.processFileItem(processItem as FileProcessItem);
      }
    } catch (error) {
      logger.error("UploadEventHandler", "Error processing item", error);
    }
  }

  private insertPlaceholder(processItem: FileProcessItem): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) return;

    const editor = activeView.editor;
    const cursor = editor.getCursor();
    const placeholderText = `[${processItem.value.name}]${this.getPlaceholderSuffix(processItem)}\n`;

    editor.replaceRange(placeholderText, cursor);
    editor.setCursor({ line: cursor.line + 1, ch: 0 });
  }

  private replaceLocalLinkWithPlaceholder(processItem: FileProcessItem): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor || !processItem.localPath) return;

    const editor = activeView.editor;
    const content = editor.getValue();
    const escapedPath = processItem.localPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`(!?\\[[^\\]]*\\])\\(${escapedPath}\\)`, "g");
    const placeholder = `$1${this.getPlaceholderSuffix(processItem)}`;

    editor.setValue(content.replace(linkRegex, placeholder));
  }

  private getPlaceholderSuffix(processItem: FileProcessItem): string {
    const file = processItem.value;
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    const showProgress = isFileTypeSupported(supportedTypes, processItem.extension) 
      && file.size > MULTIPART_UPLOAD_THRESHOLD;
    
    return showProgress
      ? `📤(0%)${t("upload.uploading")}<!--${processItem.id}-->`
      : `⏳${t("upload.progressing")}<!--${processItem.id}-->`;
  }

  private async processFileItem(processItem: FileProcessItem): Promise<void> {
    const file = processItem.value;
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    
    if (!isFileTypeSupported(supportedTypes, processItem.extension)) {
      await this.saveToVault(file, processItem.id);
      return;
    }

    const debouncer = new ProgressDebouncer(100);
    this.progressDebouncers.set(processItem.id, debouncer);

    try {
      const result = await this.uploadServiceManager.uploadFile(
        file,
        undefined,
        (progress) => {
          debouncer.update(progress, (p) => this.updateProgress(processItem.id, file.name, p));
        },
      );

      if (result.success && result.url) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const markdown = isImageExtension(ext)
          ? `![${file.name}](${encodeURI(result.url)})`
          : `[${file.name}](${encodeURI(result.url)})`;
        this.replacePlaceholder(processItem.id, markdown);
      } else {
        this.replacePlaceholder(processItem.id, `❌ ${t("upload.failed")} ${file.name}: ${result.error || t("error.uploadFailed")}`);
      }
    } finally {
      debouncer.clear();
      this.progressDebouncers.delete(processItem.id);
    }
  }

  private updateProgress(id: string, fileName: string, progress: number): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) return;

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${id}-->`;
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) return;

    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    if (linkStartIndex === -1) return;

    const progressText = `[${fileName}]📤(${Math.round(progress)}%)${t("upload.uploading")}${marker}`;
    editor.setValue(
      content.substring(0, linkStartIndex) + progressText + content.substring(markerIndex + marker.length)
    );
  }

  private replacePlaceholder(id: string, text: string): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) return;

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${id}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      editor.replaceSelection(text + "\n");
      return;
    }

    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    if (linkStartIndex === -1) {
      editor.replaceSelection(text + "\n");
      return;
    }

    editor.setValue(
      content.substring(0, linkStartIndex) + text + content.substring(markerIndex + marker.length)
    );
  }

  private async saveToVault(file: File, id: string): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    try {
      // @ts-ignore
      const attachmentFolderPath: string = this.app.vault.getConfig("attachmentFolderPath") || "./";
      const currentFolder = activeView.file?.parent?.path || "";
      let attachmentFolder: string;
      
      if (attachmentFolderPath === "/" || attachmentFolderPath === "") {
        attachmentFolder = "";
      } else if (attachmentFolderPath.startsWith("./")) {
        const subFolder = attachmentFolderPath.slice(2);
        attachmentFolder = currentFolder 
          ? (subFolder ? `${currentFolder}/${subFolder}` : currentFolder)
          : subFolder;
      } else {
        attachmentFolder = attachmentFolderPath;
      }

      if (attachmentFolder && !(await this.app.vault.adapter.exists(attachmentFolder))) {
        await this.app.vault.createFolder(attachmentFolder);
      }

      const uniqueName = this.getUniqueFileName(file.name, attachmentFolder);
      const fullPath = attachmentFolder ? `${attachmentFolder}/${uniqueName}` : uniqueName;
      const created = await this.app.vault.createBinary(fullPath, await file.arrayBuffer());

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const markdown = isImageExtension(ext)
        ? `![${file.name}](${created.path})`
        : `[${file.name}](${created.path})`;
      this.replacePlaceholder(id, markdown);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.replacePlaceholder(id, `❌ ${t("upload.progrefailed")} ${file.name}: ${errorMsg}`);
    }
  }

  private getUniqueFileName(fileName: string, folderPath: string): string {
    const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;
    if (!this.app.vault.getAbstractFileByPath(fullPath)) return fileName;

    const dotIndex = fileName.lastIndexOf(".");
    const name = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    const ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";

    let counter = 1;
    let uniqueName = `${name}-${counter}${ext}`;
    while (this.app.vault.getAbstractFileByPath(folderPath ? `${folderPath}/${uniqueName}` : uniqueName)) {
      counter++;
      uniqueName = `${name}-${counter}${ext}`;
    }
    return uniqueName;
  }
}
