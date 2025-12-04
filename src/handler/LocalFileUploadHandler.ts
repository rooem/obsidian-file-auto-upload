import { App } from "obsidian";
import { UploadEventHandler } from "./UploadEventHandler";
import { logger } from "../utils/Logger";

export class LocalFileUploadHandler {
  constructor(
    private app: App,
    private uploadEventHandler: UploadEventHandler
  ) {}

  async handleLocalFileUpload(localFiles: string[]): Promise<void> {
    const fileItems: Array<{ file: File; localPath: string }> = [];
    
    for (const filePath of localFiles) {
      try {
        const arrayBuffer = await this.app.vault.adapter.readBinary(filePath);
        const fileName = filePath.split('/').pop() || 'file';
        const file = new File([new Blob([arrayBuffer])], fileName);
        fileItems.push({ file, localPath: filePath });
      } catch (error) {
        logger.error("LocalFileUploadHandler", "Failed to read local file", { filePath, error });
      }
    }

    if (fileItems.length > 0) {
      await this.uploadEventHandler.handleFileUploadEvent(fileItems);
    }
  }
}
