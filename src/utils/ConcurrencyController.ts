/**
 * Concurrency controller for limiting parallel operations
 */
export class ConcurrencyController {
  private queue: Array<() => void> = [];
  private running = 0;
  private aborted = false;

  constructor(private maxConcurrent: number = 3) {}

  /**
   * Add a task to the queue and execute when a slot is available
   * @param task - Async task to execute
   * @returns Promise that resolves when task completes
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.aborted) {
      throw new Error("ConcurrencyController has been aborted");
    }

    while (this.running >= this.maxConcurrent && !this.aborted) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    if (this.aborted) {
      throw new Error("ConcurrencyController has been aborted");
    }

    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Abort all pending tasks and clear the queue
   */
  abort(): void {
    this.aborted = true;
    // Release all waiting tasks
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  getRunningCount(): number {
    return this.running;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isAborted(): boolean {
    return this.aborted;
  }
}
