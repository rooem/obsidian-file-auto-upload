import { Plugin } from "obsidian";
import { t } from "../i18n";

export class StatusBar {
  private statusBarItem: HTMLElement;
  private totalCount = 0;
  private uploadedCount = 0;
  private progressMap: Map<string, number> = new Map();

  constructor(plugin: Plugin) {
    this.statusBarItem = plugin.addStatusBarItem();
    this.statusBarItem.hide();
  }

  startUpload(id: string): void {
    this.totalCount++;
    this.progressMap.set(id, 0);
    this.updateDisplay();
  }

  updateProgress(id: string, progress: number): void {
    this.progressMap.set(id, progress);
    this.updateDisplay();
  }

  finishUpload(id: string): void {
    this.progressMap.delete(id);
    this.uploadedCount++;
    if (this.uploadedCount >= this.totalCount) {
      this.statusBarItem.hide();
      this.totalCount = 0;
      this.uploadedCount = 0;
    } else {
      this.updateDisplay();
    }
  }

  private updateDisplay(): void {
    if (this.totalCount === 0) {
      this.statusBarItem.hide();
      return;
    }

    const avgProgress = this.progressMap.size > 0
      ? Math.round([...this.progressMap.values()].reduce((a, b) => a + b, 0) / this.progressMap.size)
      : 0;

    const text = t("statusBar.uploading")
      .replace("{uploaded}", this.uploadedCount.toString())
      .replace("{total}", this.totalCount.toString())
      .replace("{progress}", avgProgress.toString());
    this.statusBarItem.setText(`📤 ${text}`);
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.remove();
  }
}
