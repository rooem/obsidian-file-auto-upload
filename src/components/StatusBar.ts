import { Plugin } from "obsidian";
import { t } from "../i18n";

interface OperationState {
  total: number;
  completed: number;
  progressMap: Map<string, number>;
}

/**
 * Status bar component for displaying upload/download progress
 * Shows real-time progress of file operations in Obsidian's status bar
 */
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

  /**
   * Register start of an upload operation
   * @param id - Unique identifier for the upload operation
   */
  startUpload(id: string): void {
    this.upload.total++;
    this.upload.progressMap.set(id, 0);
    this.updateDisplay();
  }

  /**
   * Register start of a download operation
   * @param id - Unique identifier for the download operation
   */
  startDownload(id: string): void {
    this.download.total++;
    this.download.progressMap.set(id, 0);
    this.updateDisplay();
  }

  /**
   * Update progress for an operation
   * @param id - Unique identifier for the operation
   * @param progress - Progress percentage (0-100)
   */
  updateProgress(id: string, progress: number): void {
    if (this.upload.progressMap.has(id)) {
      this.upload.progressMap.set(id, progress);
    } else if (this.download.progressMap.has(id)) {
      this.download.progressMap.set(id, progress);
    }
    this.updateDisplay();
  }

  /**
   * Mark an upload operation as completed
   * @param id - Unique identifier for the upload operation
   */
  finishUpload(id: string): void {
    this.upload.progressMap.delete(id);
    this.upload.completed++;
    this.checkReset(this.upload);
    this.updateDisplay();
  }

  /**
   * Mark a download operation as completed
   * @param id - Unique identifier for the download operation
   */
  finishDownload(id: string): void {
    this.download.progressMap.delete(id);
    this.download.completed++;
    this.checkReset(this.download);
    this.updateDisplay();
  }

  /**
   * Reset counters when all operations of a type are completed
   * @param state - Operation state to check and reset if needed
   */
  private checkReset(state: OperationState): void {
    if (state.completed >= state.total) {
      state.total = 0;
      state.completed = 0;
    }
  }

  /**
   * Calculate average progress across all operations of a type
   * @param progressMap - Map of operation IDs to progress percentages
   * @returns Average progress percentage
   */
  private getAvgProgress(progressMap: Map<string, number>): number {
    if (progressMap.size === 0) {
      return 0;
    }
    return Math.round(
      [...progressMap.values()].reduce((a, b) => a + b, 0) / progressMap.size,
    );
  }

  /**
   * Update status bar display with current operation information
   */
  private updateDisplay(): void {
    const parts: string[] = [];

    // Add upload status if there are active uploads
    if (this.upload.total > 0) {
      const progress = this.getAvgProgress(this.upload.progressMap);
      const text = t("statusBar.uploading")
        .replace("{uploaded}", this.upload.completed.toString())
        .replace("{total}", this.upload.total.toString())
        .replace("{progress}", progress.toString());
      parts.push(`⬆️ ${text}`);
    }

    // Add download status if there are active downloads
    if (this.download.total > 0) {
      const progress = this.getAvgProgress(this.download.progressMap);
      const text = t("statusBar.downloading")
        .replace("{downloaded}", this.download.completed.toString())
        .replace("{total}", this.download.total.toString())
        .replace("{progress}", progress.toString());
      parts.push(`⬇️ ${text}`);
    }

    // Show or hide status bar based on active operations
    if (parts.length === 0) {
      this.statusBarItem.hide();
    } else {
      this.statusBarItem.setText(parts.join(" | "));
      this.statusBarItem.show();
    }
  }

  /**
   * Dispose of status bar component
   * Note: statusBarItem is automatically cleaned up by Obsidian when plugin unloads
   */
  dispose(): void {
    // Clear internal state only, let Obsidian handle DOM cleanup
    this.upload.progressMap.clear();
    this.download.progressMap.clear();
  }
}
