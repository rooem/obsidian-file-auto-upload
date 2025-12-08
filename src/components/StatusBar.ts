import { Plugin } from "obsidian";
import { t } from "../i18n";

type OperationType = "upload" | "download";

export class StatusBar {
  private statusBarItem: HTMLElement;
  private totalCount = 0;
  private completedCount = 0;
  private progressMap: Map<string, number> = new Map();
  private currentOperation: OperationType = "upload";

  constructor(plugin: Plugin) {
    this.statusBarItem = plugin.addStatusBarItem();
    this.statusBarItem.hide();
  }

  startUpload(id: string): void {
    this.start(id, "upload");
  }

  startDownload(id: string): void {
    this.start(id, "download");
  }

  private start(id: string, operation: OperationType): void {
    this.totalCount++;
    this.currentOperation = operation;
    this.progressMap.set(id, 0);
    this.updateDisplay();
  }

  updateProgress(id: string, progress: number): void {
    this.progressMap.set(id, progress);
    this.updateDisplay();
  }

  finishUpload(id: string): void {
    this.finish(id);
  }

  finishDownload(id: string): void {
    this.finish(id);
  }

  private finish(id: string): void {
    this.progressMap.delete(id);
    this.completedCount++;
    if (this.completedCount >= this.totalCount) {
      this.statusBarItem.hide();
      this.totalCount = 0;
      this.completedCount = 0;
    } else {
      this.updateDisplay();
    }
  }

  private updateDisplay(): void {
    if (this.totalCount === 0) {
      this.statusBarItem.hide();
      return;
    }

    const avgProgress =
      this.progressMap.size > 0
        ? Math.round(
            [...this.progressMap.values()].reduce((a, b) => a + b, 0) /
              this.progressMap.size,
          )
        : 0;

    const key =
      this.currentOperation === "upload"
        ? "statusBar.uploading"
        : "statusBar.downloading";
    const icon = this.currentOperation === "upload" ? "📤" : "📥";

    const text = t(key)
      .replace("{uploaded}", this.completedCount.toString())
      .replace("{downloaded}", this.completedCount.toString())
      .replace("{total}", this.totalCount.toString())
      .replace("{progress}", avgProgress.toString());
    this.statusBarItem.setText(`${icon} ${text}`);
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.remove();
  }
}
