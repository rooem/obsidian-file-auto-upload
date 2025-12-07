/**
 * Debouncer for progress updates - only updates at key milestones
 */
export class ProgressDebouncer {
  private lastMilestone = -1;
  private milestones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  constructor(_minInterval: number = 100) {}

  /**
   * Update progress only at key milestones (0%, 25%, 50%, 75%, 100%)
   */
  update(
    progress: number,
    callback: (progress: number) => void,
  ): void {
    const milestone = this.milestones.find((m) => progress >= m && m > this.lastMilestone);
    if (milestone !== undefined) {
      this.lastMilestone = milestone;
      callback(milestone);
    }
  }

  clear(): void {
    this.lastMilestone = -1;
  }
}
