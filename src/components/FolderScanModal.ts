import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";
import { FolderScanResult } from "../common/MarkdownLinkFinder";

/**
 * Modal dialog for folder scan results with progress
 */
export class FolderScanModal extends Modal {
  private result: FolderScanResult;
  private onUpload: (onProgress: (current: number, total: number) => void) => Promise<void>;
  private progressEl?: HTMLElement;
  private uploadBtn?: HTMLButtonElement;
  private isUploading = false;

  constructor(app: App, result: FolderScanResult, onUpload: (onProgress: (current: number, total: number) => void) => Promise<void>) {
    super(app);
    this.result = result;
    this.onUpload = onUpload;
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(t("upload.folderScanTitle")).setHeading();

    const messageDiv = contentEl.createDiv();
    messageDiv.createEl("p", {
      text: t("upload.folderScanResult")
        .replace("{docs}", this.result.totalDocs.toString())
        .replace("{files}", this.result.uploadableFiles.length.toString()),
    });

    this.progressEl = contentEl.createDiv({ cls: "folder-upload-progress" });
    this.progressEl.style.display = "none";
    this.progressEl.style.marginBottom = "10px";
    
    // Create progress bar container
    const progressBarContainer = this.progressEl.createDiv();
    progressBarContainer.setCssStyles({
      width: "100%",
      height: "6px",
      backgroundColor: "var(--background-modifier-border)",
      borderRadius: "3px",
      overflow: "hidden",
      marginBottom: "5px",
    });
    
    const progressBar = progressBarContainer.createDiv();
    progressBar.setCssStyles({
      height: "100%",
      width: "0%",
      backgroundColor: "var(--interactive-accent)",
      borderRadius: "3px",
      transition: "width 0.3s ease",
    });
    progressBar.addClass("progress-bar-fill");
    
    const progressText = this.progressEl.createDiv();
    progressText.addClass("progress-text");
    progressText.setCssStyles({ textAlign: "center", fontSize: "12px" });

    const buttonDiv = contentEl.createDiv();
    buttonDiv.setCssStyles({ textAlign: "center", marginTop: "20px", display: "flex", gap: "10px", justifyContent: "center" });

    if (this.result.uploadableFiles.length > 0) {
      this.uploadBtn = buttonDiv.createEl("button", {
        text: t("upload.folderUploadBtn"),
        cls: "mod-cta",
      });
      this.uploadBtn.onclick = async () => {
        if (this.isUploading) return;
        this.isUploading = true;
        this.uploadBtn!.disabled = true;
        this.uploadBtn!.setText(t("upload.uploading"));
        this.progressEl!.style.display = "block";
        
        await this.onUpload((current, total) => {
          const percent = Math.round((current / total) * 100);
          const bar = this.progressEl!.querySelector(".progress-bar-fill") as HTMLElement;
          const text = this.progressEl!.querySelector(".progress-text") as HTMLElement;
          if (bar) bar.style.width = `${percent}%`;
          if (text) text.setText(`${current}/${total}`);
        });
        
        this.uploadBtn!.setText(t("upload.folderUploadBtn"));
        this.uploadBtn!.disabled = false;
        this.isUploading = false;
        this.progressEl!.style.display = "none";
      };
    }

    const closeBtn = buttonDiv.createEl("button", {
      text: t("upload.folderScanClose"),
    });
    closeBtn.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }

  updateScanProgress(current: number, total: number) {
    if (this.progressEl) {
      this.progressEl.style.display = "block";
      const percent = Math.round((current / total) * 100);
      const bar = this.progressEl.querySelector(".progress-bar-fill") as HTMLElement;
      const text = this.progressEl.querySelector(".progress-text") as HTMLElement;
      if (bar) bar.style.width = `${percent}%`;
      if (text) text.setText(`${t("upload.scanning")} ${current}/${total}`);
    }
  }
}
