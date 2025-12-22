import { logger } from "./Logger";

/**
 * Interface for detailed progress information
 */
export interface ProgressInfo {
  id: string;
  totalBytes: number;
  loadedBytes: number;
  startTime: number;
  lastUpdated: number;
  speed: number; // bytes per second
  eta: number; // estimated time of arrival in seconds
  progress: number; // percentage 0-100
}

/**
 * Enhanced progress tracker with speed calculation and ETA estimation
 */
export class ProgressTracker {
  private progresses: Map<string, ProgressInfo> = new Map();
  private updateInterval: number = 1000; // Update interval in milliseconds

  /**
   * Start tracking progress for an operation
   * @param id - Unique identifier for the operation
   * @param totalBytes - Total bytes to transfer
   */
  start(id: string, totalBytes: number): void {
    const startTime = Date.now();
    this.progresses.set(id, {
      id,
      totalBytes,
      loadedBytes: 0,
      startTime,
      lastUpdated: startTime,
      speed: 0,
      eta: 0,
      progress: 0,
    });
  }

  /**
   * Update progress for an operation
   * @param id - Unique identifier for the operation
   * @param loadedBytes - Number of bytes transferred so far
   */
  update(id: string, loadedBytes: number): void {
    const progress = this.progresses.get(id);
    if (!progress) {
      logger.warn("ProgressTracker", "Trying to update non-existent progress", { id });
      return;
    }

    const now = Date.now();
    const deltaTime = (now - progress.lastUpdated) / 1000; // in seconds
    const deltaBytes = loadedBytes - progress.loadedBytes;

    // Calculate speed (bytes per second)
    let speed = progress.speed;
    if (deltaTime > 0 && deltaBytes >= 0) {
      const instantSpeed = deltaBytes / deltaTime;
      // Smooth speed calculation - weighted average
      speed = progress.speed > 0 
        ? progress.speed * 0.7 + instantSpeed * 0.3 
        : instantSpeed;
    }

    // Calculate ETA (estimated time of arrival)
    let eta = 0;
    if (speed > 0 && progress.totalBytes > 0) {
      const remainingBytes = progress.totalBytes - loadedBytes;
      eta = remainingBytes / speed;
    }

    // Calculate progress percentage
    const progressPercent = progress.totalBytes > 0 
      ? Math.min(100, Math.round((loadedBytes / progress.totalBytes) * 100))
      : 0;

    // Update progress info
    this.progresses.set(id, {
      ...progress,
      loadedBytes,
      lastUpdated: now,
      speed,
      eta,
      progress: progressPercent,
    });
  }

  /**
   * Finish tracking progress for an operation
   * @param id - Unique identifier for the operation
   */
  finish(id: string): void {
    this.progresses.delete(id);
  }

  /**
   * Get progress information for an operation
   * @param id - Unique identifier for the operation
   * @returns Progress information or undefined if not found
   */
  getProgress(id: string): ProgressInfo | undefined {
    return this.progresses.get(id);
  }

  /**
   * Get all progress information
   * @returns Array of all progress information
   */
  getAllProgresses(): ProgressInfo[] {
    return Array.from(this.progresses.values());
  }

  /**
   * Format bytes to human-readable format
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Format time to human-readable format
   * @param seconds - Time in seconds
   * @returns Formatted string (e.g., "1m 30s")
   */
  static formatTime(seconds: number): string {
    if (seconds <= 0) return "--";
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}h ${m}m`;
    } else if (m > 0) {
      return `${m}m ${s}s`;
    } else {
      return `${s}s`;
    }
  }

  /**
   * Format speed to human-readable format
   * @param bytesPerSecond - Speed in bytes per second
   * @returns Formatted string (e.g., "1.5 MB/s")
   */
  static formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }
}