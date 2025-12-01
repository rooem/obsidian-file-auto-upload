/**
 * Debouncer for progress updates to avoid excessive UI updates
 */
export class ProgressDebouncer {
  private lastUpdate = 0;
  private pendingUpdate: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private minInterval: number = 100) {}

  /**
   * Update progress with debouncing
   * @param progress - Current progress value
   * @param callback - Callback to execute with progress
   * @param force - Force immediate update
   */
  update(
    progress: number,
    callback: (progress: number) => void,
    force = false,
  ): void {
    const now = Date.now();

    // Force update for 0% and 100%, or if forced
    if (force || progress === 0 || progress === 100) {
      this.executeUpdate(progress, callback);
      return;
    }

    // Check if enough time has passed since last update
    if (now - this.lastUpdate >= this.minInterval) {
      this.executeUpdate(progress, callback);
    } else {
      // Store pending update
      this.pendingUpdate = progress;

      // Clear existing timer
      if (this.timer) {
        clearTimeout(this.timer);
      }

      // Schedule update
      this.timer = setTimeout(
        () => {
          if (this.pendingUpdate !== null) {
            this.executeUpdate(this.pendingUpdate, callback);
            this.pendingUpdate = null;
          }
        },
        this.minInterval - (now - this.lastUpdate),
      );
    }
  }

  /**
   * Execute the progress update
   */
  private executeUpdate(
    progress: number,
    callback: (progress: number) => void,
  ): void {
    this.lastUpdate = Date.now();
    callback(progress);
  }

  /**
   * Clear any pending updates
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingUpdate = null;
  }
}
