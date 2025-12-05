import { App, MarkdownView } from "obsidian";
import { FileProcessItem } from "../../types/index";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { UploadServiceManager } from "../../uploader/UploaderManager";
import { isFileTypeSupported, isImageExtension } from "../../utils/FileUtils";
import { t } from "../../i18n";
import { logger } from "../../utils/Logger";
import { ProgressDebouncer } from "../../utils/ProgressDebouncer";

export class FileItemProcessor {
  private progressDebouncers: Map<string, ProgressDebouncer> = new Map();

  constructor(
    private app: App,
    private configurationManager: ConfigurationManager,
    private uploadServiceManager: UploadServiceManager,
  ) {}

  async process(processItem: FileProcessItem): Promise<void> {
    const file = processItem.value;
    logger.debug("FileItemProcessor", "Processing file item", {
      fileName: file.name,
      fileSize: file.size,
      extension: processItem.extension,
      localPath: processItem.localPath,
    });

    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    if (!isFileTypeSupported(supportedTypes, processItem.extension)) {
      await this.processNotSupportedFile(file, processItem.id);
      return;
    }

    await this.uploadFile(file, processItem.id, processItem.localPath);
  }

  private async uploadFile(
    file: File,
    id: string,
    localPath?: string,
  ): Promise<void> {
    const debouncer = new ProgressDebouncer(100);
    this.progressDebouncers.set(id, debouncer);

    try {
      const result = await this.uploadServiceManager.uploadFile(
        file,
        undefined,
        (progress) => {
          debouncer.update(progress, (debouncedProgress) => {
            this.updateUploadProgress(id, file.name, debouncedProgress);
          });
        },
      );

      this.handleUploadResult(result, file, id, localPath);
    } finally {
      debouncer.clear();
      this.progressDebouncers.delete(id);
    }
  }

  private handleUploadResult(
    result: { success: boolean; url?: string; error?: string },
    file: File,
    id: string,
    _localPath?: string,
  ): void {
    if (result.success && result.url) {
      logger.debug("FileItemProcessor", "File processed successfully", {
        fileName: file.name,
      });
      this.replacePlaceholderWithLink(id, result.url, file.name);
    } else {
      const errorMsg = result.error || t("error.uploadFailed");
      logger.error("FileItemProcessor", "File processing failed", {
        fileName: file.name,
        error: errorMsg,
      });
      this.replacePlaceholderWithError(id, file.name, errorMsg);
    }
  }

  private updateUploadProgress(
    id: string,
    fileName: string,
    progress: number,
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${id}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      return;
    }

    // 新格式: [fileName]📤(progress%)上传中<!--id-->
    const progressText = `[${fileName}]📤(${Math.round(progress)}%)${t("upload.uploading")}${marker}`;

    // 找到包含marker的整个占位符 [...]...<!--id-->
    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    const markerEndIndex = markerIndex + marker.length;

    if (linkStartIndex === -1) {
      return;
    }

    const beforeContent = content.substring(0, linkStartIndex);
    const afterContent = content.substring(markerEndIndex);

    editor.setValue(beforeContent + progressText + afterContent);
  }

  private replacePlaceholderWithLink(
    id: string,
    url: string,
    fileName: string,
  ): void {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const encodedUrl = encodeURI(url);
    const markdown = isImageExtension(extension)
      ? `![${fileName}](${encodedUrl})`
      : `[${fileName}](${encodedUrl})`;
    this.replacePlaceholderById(id, markdown);
  }

  private replacePlaceholderWithError(
    id: string,
    fileName: string,
    errorMessage?: string,
  ): void {
    const supportedTypes = this.configurationManager.getAutoUploadFileTypes();
    const extension = fileName.split(".").pop()?.toLowerCase();
    const pre = !isFileTypeSupported(supportedTypes, extension)
      ? t("upload.progrefailed")
      : t("upload.failed");
    const errorText = errorMessage
      ? `❌ ${pre} ${fileName}: ${errorMessage}`
      : `❌ ${pre} ${fileName}`;
    this.replacePlaceholderById(id, errorText);
  }

  private replacePlaceholderById(uploadId: string, text: string): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${uploadId}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      // 没有占位符时，在光标处插入
      editor.replaceSelection(text + "\n");
      return;
    }

    // 新格式: [fileName]📤(progress%)上传中<!--id-->
    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    const markerEndIndex = markerIndex + marker.length;

    if (linkStartIndex === -1) {
      editor.replaceSelection(text + "\n");
      return;
    }

    const beforeContent = content.substring(0, linkStartIndex);
    const afterContent = content.substring(markerEndIndex);

    editor.setValue(beforeContent + text + afterContent);
  }

  private async processNotSupportedFile(file: File, id: string): Promise<void> {
    logger.debug(
      "FileItemProcessor",
      "File type not supported for upload, saving to vault",
      {
        fileName: file.name,
      },
    );

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      logger.warn(
        "FileItemProcessor",
        "File type not supported: No active markdown view",
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

      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const markdown = isImageExtension(extension)
        ? `![${file.name}](${created.path})`
        : `[${file.name}](${created.path})`;
      this.replacePlaceholderById(id, markdown);
    } catch (error: unknown) {
      logger.error("FileItemProcessor", "Failed to save file to vault", {
        fileName: file.name,
        error,
      });
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.replacePlaceholderWithError(id, file.name, errorMsg);
    }
  }

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
}
