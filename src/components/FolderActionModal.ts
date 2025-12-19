import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

export interface FolderActionConfig {
  titleKey: string;
  resultKey: string;
  actionBtnKey: string;
  progressKey: string;
  scanningKey: string;
  closeKey: string;
}

export interface FolderActionResult {
  totalDocs: number;
  fileCount: number;
}

export class FolderActionModal extends Modal {
  private result: FolderActionResult;
  private config: FolderActionConfig;
  private onAction: (onProgress: (current: number, total: number) => void) => Promise<unknown>;
  private progressEl?: HTMLElement;
  private actionBtn?: HTMLButtonElement;
  private isProcessing = false;

  constructor(
    app: App,
    result: FolderActionResult,
    config: FolderActionConfig,
    onAction: (onProgress: (current: number, total: number) => void) => Promise<unknown>
  ) {
    super(app);
    this.result = result;
    this.config = config;
    this.onAction = onAction;
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(t(this.config.titleKey)).setHeading();

    const messageDiv = contentEl.createDiv();
    messageDiv.createEl("p", {
      text: t(this.config.resultKey)
        .replace("{docs}", this.result.totalDocs.toString())
        .replace("{files}", this.result.fileCount.toString()),
    });

    this.progressEl = contentEl.createDiv({ cls: "folder-action-progress" });
    this.progressEl.style.display = "none";
    this.progressEl.style.marginBottom = "10px";
    
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

    if (this.result.fileCount > 0) {
      this.actionBtn = buttonDiv.createEl("button", {
        text: t(this.config.actionBtnKey),
        cls: "mod-cta",
      });
      this.actionBtn.onclick = async () => {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.actionBtn!.disabled = true;
        this.actionBtn!.setText(t(this.config.progressKey));
        this.progressEl!.style.display = "block";
        
        await this.onAction((current, total) => {
          const percent = Math.round((current / total) * 100);
          const bar = this.progressEl!.querySelector(".progress-bar-fill") as HTMLElement;
          const text = this.progressEl!.querySelector(".progress-text") as HTMLElement;
          if (bar) bar.style.width = `${percent}%`;
          if (text) text.setText(`${current}/${total}`);
        });
        
        this.actionBtn!.setText(t(this.config.actionBtnKey));
        this.actionBtn!.disabled = false;
        this.isProcessing = false;
        this.progressEl!.style.display = "none";
      };
    }

    const closeBtn = buttonDiv.createEl("button", {
      text: t(this.config.closeKey),
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
      if (text) text.setText(`${t(this.config.scanningKey)} ${current}/${total}`);
    }
  }

  updateResult(totalDocs: number, fileCount: number) {
    this.result.totalDocs = totalDocs;
    this.result.fileCount = fileCount;
  }
}



