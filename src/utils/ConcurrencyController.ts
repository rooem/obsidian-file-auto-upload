/**
 * Concurrency controller for limiting parallel operations
 */
export class ConcurrencyController {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;

  constructor(private maxConcurrent: number = 3) {}

  /**
   * Add a task to the queue and execute when a slot is available
   * @param task - Async task to execute
   * @returns Promise that resolves when task completes
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise((resolve) => {
        this.queue.push(resolve as () => Promise<void>);
      });
    }

    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      const nextTask = this.queue.shift();
      if (nextTask) {
        void nextTask();
      }
    }
  }

  /**
   * Get current number of running tasks
   */
  getRunningCount(): number {
    return this.running;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}
