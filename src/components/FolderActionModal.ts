import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

export interface FolderActionConfig {
  titleKey: string;
  resultKey: string;
  actionBtnKey: string;
  progressKey: string;
  scanningKey: string;
  closeKey: string;
  cancelKey?: string; // Added cancel key for translation
}

export interface FolderActionResult {
  totalDocs: number;
  fileCount: number;
}

export class FolderActionModal extends Modal {
  private result: FolderActionResult;
  private config: FolderActionConfig;
  private onAction: (
    onProgress: (current: number, total: number) => void,
  ) => Promise<unknown>;
  private progressEl?: HTMLElement;
  private actionBtn?: HTMLButtonElement;
  private cancelBtn?: HTMLButtonElement; // Added cancel button
  private isProcessing = false;
  private isCancelled = false; // Added cancellation flag

  constructor(
    app: App,
    result: FolderActionResult,
    config: FolderActionConfig,
    onAction: (
      onProgress: (current: number, total: number) => void,
    ) => Promise<unknown>,
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
    this.progressEl.style.position = "relative"; // Added for positioning cancel button

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
    buttonDiv.setCssStyles({
      textAlign: "center",
      marginTop: "20px",
      display: "flex",
      gap: "10px",
      justifyContent: "center",
    });

    if (this.result.fileCount > 0) {
      this.actionBtn = buttonDiv.createEl("button", {
        text: t(this.config.actionBtnKey),
        cls: "mod-cta",
      });
      this.actionBtn.onclick = async () => {
        if (this.isProcessing) {
          return;
        }
        this.isProcessing = true;
        this.isCancelled = false; // Reset cancellation flag
        this.actionBtn!.disabled = true;
        this.actionBtn!.setText(t(this.config.progressKey));
        this.progressEl!.style.display = "block";

        // Show cancel button during processing
        if (this.cancelBtn) {
          this.cancelBtn.style.display = "inline-block";
        }

        try {
          await this.onAction((current, total) => {
            // Check if operation was cancelled
            if (this.isCancelled) {
              throw new Error("Operation cancelled by user");
            }

            const percent = Math.round((current / total) * 100);
            const bar = this.progressEl!.querySelector(
              ".progress-bar-fill",
            ) as HTMLElement;
            const text = this.progressEl!.querySelector(
              ".progress-text",
            ) as HTMLElement;
            if (bar) {
              bar.style.width = `${percent}%`;
            }
            if (text) {
              text.setText(`${current}/${total}`);
            }
          });
        } catch (error) {
          if (error instanceof Error && error.message === "Operation cancelled by user") {
            console.log("Operation was cancelled by user");
          } else {
            throw error;
          }
        } finally {
          this.actionBtn!.setText(t(this.config.actionBtnKey));
          this.actionBtn!.disabled = false;
          this.isProcessing = false;
          this.progressEl!.style.display = "none";
          
          // Hide cancel button after processing
          if (this.cancelBtn) {
            this.cancelBtn.style.display = "none";
          }
        }
      };
    }

    // Create cancel button
    this.cancelBtn = buttonDiv.createEl("button", {
      text: t(this.config.cancelKey || "Cancel"),
    });
    this.cancelBtn.style.display = "none"; // Hidden by default
    this.cancelBtn.onclick = () => {
      this.isCancelled = true;
      if (this.cancelBtn) {
        this.cancelBtn.disabled = true;
        this.cancelBtn.setText("Cancelling...");
      }
    };

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
      const bar = this.progressEl.querySelector(
        ".progress-bar-fill",
      ) as HTMLElement;
      const text = this.progressEl.querySelector(
        ".progress-text",
      ) as HTMLElement;
      if (bar) {
        bar.style.width = `${percent}%`;
      }
      if (text) {
        text.setText(`${t(this.config.scanningKey)} ${current}/${total}`);
      }
    }
  }

  updateResult(totalDocs: number, fileCount: number) {
    this.result.totalDocs = totalDocs;
    this.result.fileCount = fileCount;
  }
}