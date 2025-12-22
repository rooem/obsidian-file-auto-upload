import { Plugin } from "obsidian";
import { t } from "../i18n";
import { ProgressTracker, ProgressInfo } from "../common/ProgressTracker";

interface OperationState {
  total: number;
  completed: number;
  progressMap: Map<string, ProgressInfo>;
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
   * @param totalBytes - Total bytes to transfer
   */
  startUpload(id: string, totalBytes: number = 0): void {
    this.upload.total++;
    const progressInfo: ProgressInfo = {
      id,
      totalBytes,
      loadedBytes: 0,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      speed: 0,
      eta: 0,
      progress: 0,
    };
    this.upload.progressMap.set(id, progressInfo);
    this.updateDisplay();
  }

  /**
   * Register start of a download operation
   * @param id - Unique identifier for the download operation
   * @param totalBytes - Total bytes to transfer
   */
  startDownload(id: string, totalBytes: number = 0): void {
    this.download.total++;
    const progressInfo: ProgressInfo = {
      id,
      totalBytes,
      loadedBytes: 0,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      speed: 0,
      eta: 0,
      progress: 0,
    };
    this.download.progressMap.set(id, progressInfo);
    this.updateDisplay();
  }

  /**
   * Update progress for an operation
   * @param id - Unique identifier for the operation
   * @param loadedBytes - Number of bytes transferred so far
   */
  updateProgress(id: string, loadedBytes: number): void {
    if (this.upload.progressMap.has(id)) {
      const progress = this.upload.progressMap.get(id)!;
      ProgressTracker.prototype.update.call({ progresses: this.upload.progressMap }, id, loadedBytes);
    } else if (this.download.progressMap.has(id)) {
      const progress = this.download.progressMap.get(id)!;
      ProgressTracker.prototype.update.call({ progresses: this.download.progressMap }, id, loadedBytes);
    }
    this.updateDisplay();
  }

  /**
   * Update progress percentage for an operation (backward compatibility)
   * @param id - Unique identifier for the operation
   * @param progress - Progress percentage (0-100)
   */
  updateProgressPercentage(id: string, progress: number): void {
    if (this.upload.progressMap.has(id)) {
      const progressInfo = this.upload.progressMap.get(id)!;
      const loadedBytes = Math.round((progress / 100) * progressInfo.totalBytes);
      this.updateProgress(id, loadedBytes);
    } else if (this.download.progressMap.has(id)) {
      const progressInfo = this.download.progressMap.get(id)!;
      const loadedBytes = Math.round((progress / 100) * progressInfo.totalBytes);
      this.updateProgress(id, loadedBytes);
    }
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
   * @param progressMap - Map of operation IDs to progress info
   * @returns Average progress info
   */
  private getAvgProgress(progressMap: Map<string, ProgressInfo>): ProgressInfo {
    if (progressMap.size === 0) {
      return {
        id: "",
        totalBytes: 0,
        loadedBytes: 0,
        startTime: Date.now(),
        lastUpdated: Date.now(),
        speed: 0,
        eta: 0,
        progress: 0,
      };
    }

    const progresses = Array.from(progressMap.values());
    const totalBytes = progresses.reduce((sum, p) => sum + p.totalBytes, 0);
    const loadedBytes = progresses.reduce((sum, p) => sum + p.loadedBytes, 0);
    const speeds = progresses.reduce((sum, p) => sum + p.speed, 0);
    const etas = progresses.reduce((sum, p) => sum + p.eta, 0);

    return {
      id: "",
      totalBytes,
      loadedBytes,
      startTime: Math.min(...progresses.map(p => p.startTime)),
      lastUpdated: Math.max(...progresses.map(p => p.lastUpdated)),
      speed: speeds / progresses.length,
      eta: totalBytes > 0 ? (totalBytes - loadedBytes) / (speeds / progresses.length) : 0,
      progress: totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0,
    };
  }

  /**
   * Update status bar display with current operation information
   */
  private updateDisplay(): void {
    const parts: string[] = [];

    // Add upload status if there are active uploads
    if (this.upload.total > 0) {
      const progressInfo = this.getAvgProgress(this.upload.progressMap);
      const speedText = ProgressTracker.formatSpeed(progressInfo.speed);
      const etaText = ProgressTracker.formatTime(progressInfo.eta);
      
      const text = t("statusBar.uploadingDetailed")
        .replace("{uploaded}", this.upload.completed.toString())
        .replace("{total}", this.upload.total.toString())
        .replace("{progress}", progressInfo.progress.toString())
        .replace("{speed}", speedText)
        .replace("{eta}", etaText);
      parts.push(`⬆️ ${text}`);
    }

    // Add download status if there are active downloads
    if (this.download.total > 0) {
      const progressInfo = this.getAvgProgress(this.download.progressMap);
      const speedText = ProgressTracker.formatSpeed(progressInfo.speed);
      const etaText = ProgressTracker.formatTime(progressInfo.eta);
      
      const text = t("statusBar.downloadingDetailed")
        .replace("{downloaded}", this.download.completed.toString())
        .replace("{total}", this.download.total.toString())
        .replace("{progress}", progressInfo.progress.toString())
        .replace("{speed}", speedText)
        .replace("{eta}", etaText);
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