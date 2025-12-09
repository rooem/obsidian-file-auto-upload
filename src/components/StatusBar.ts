import { Plugin } from "obsidian";
import { t } from "../i18n";

interface OperationState {
  total: number;
  completed: number;
  progressMap: Map<string, number>;
}

export class StatusBar {
  private statusBarItem: HTMLElement;
  private upload: OperationState = {
    total: 0,
    completed: 0,
    progressMap: new Map(),
  };
  private download: OperationState = {
    total: 0,
    completed: 0,
    progressMap: new Map(),
  };

  constructor(plugin: Plugin) {
    this.statusBarItem = plugin.addStatusBarItem();
    this.statusBarItem.hide();
  }

  startUpload(id: string): void {
    this.upload.total++;
    this.upload.progressMap.set(id, 0);
    this.updateDisplay();
  }

  startDownload(id: string): void {
    this.download.total++;
    this.download.progressMap.set(id, 0);
    this.updateDisplay();
  }

  updateProgress(id: string, progress: number): void {
    if (this.upload.progressMap.has(id)) {
      this.upload.progressMap.set(id, progress);
    } else if (this.download.progressMap.has(id)) {
      this.download.progressMap.set(id, progress);
    }
    this.updateDisplay();
  }

  finishUpload(id: string): void {
    this.upload.progressMap.delete(id);
    this.upload.completed++;
    this.checkReset(this.upload);
    this.updateDisplay();
  }

  finishDownload(id: string): void {
    this.download.progressMap.delete(id);
    this.download.completed++;
    this.checkReset(this.download);
    this.updateDisplay();
  }

  private checkReset(state: OperationState): void {
    if (state.completed >= state.total) {
      state.total = 0;
      state.completed = 0;
    }
  }

  private getAvgProgress(progressMap: Map<string, number>): number {
    if (progressMap.size === 0) {
      return 0;
    }
    return Math.round(
      [...progressMap.values()].reduce((a, b) => a + b, 0) / progressMap.size,
    );
  }

  private updateDisplay(): void {
    const parts: string[] = [];

    if (this.upload.total > 0) {
      const progress = this.getAvgProgress(this.upload.progressMap);
      const text = t("statusBar.uploading")
        .replace("{uploaded}", this.upload.completed.toString())
        .replace("{total}", this.upload.total.toString())
        .replace("{progress}", progress.toString());
      parts.push(`⬆️ ${text}`);
    }

    if (this.download.total > 0) {
      const progress = this.getAvgProgress(this.download.progressMap);
      const text = t("statusBar.downloading")
        .replace("{downloaded}", this.download.completed.toString())
        .replace("{total}", this.download.total.toString())
        .replace("{progress}", progress.toString());
      parts.push(`⬇️ ${text}`);
    }

    if (parts.length === 0) {
      this.statusBarItem.hide();
    } else {
      this.statusBarItem.setText(parts.join(" | "));
      this.statusBarItem.show();
    }
  }

  dispose(): void {
    this.statusBarItem.remove();
  }
}
