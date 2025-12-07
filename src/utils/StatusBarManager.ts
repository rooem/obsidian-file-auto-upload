import { Plugin } from "obsidian";
import { t } from "../i18n";

export class StatusBarManager {
  private statusBarItem: HTMLElement;
  private uploadCount = 0;
  private progressMap: Map<string, number> = new Map();

  constructor(plugin: Plugin) {
    this.statusBarItem = plugin.addStatusBarItem();
    this.statusBarItem.hide();
  }

  startUpload(id: string): void {
    this.uploadCount++;
    this.progressMap.set(id, 0);
    this.updateDisplay();
  }

  updateProgress(id: string, progress: number): void {
    this.progressMap.set(id, progress);
    this.updateDisplay();
  }

  finishUpload(id: string): void {
    this.progressMap.delete(id);
    this.uploadCount = Math.max(0, this.uploadCount - 1);
    if (this.uploadCount === 0) {
      this.statusBarItem.hide();
    } else {
      this.updateDisplay();
    }
  }

  private updateDisplay(): void {
    if (this.uploadCount === 0) {
      this.statusBarItem.hide();
      return;
    }

    const avgProgress = this.progressMap.size > 0
      ? Math.round([...this.progressMap.values()].reduce((a, b) => a + b, 0) / this.progressMap.size)
      : 0;

    const text = t("statusBar.uploading")
      .replace("{count}", this.uploadCount.toString())
      .replace("{progress}", avgProgress.toString());
    this.statusBarItem.setText(`📤${text}`);
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.remove();
  }
}
