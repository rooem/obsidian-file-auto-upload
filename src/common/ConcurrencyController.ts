/**
 * Concurrency controller for limiting parallel operations
 * Controls the number of simultaneous operations to prevent resource exhaustion
 */
export class ConcurrencyController {
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private running = 0;
  private aborted = false;
  private abortController: AbortController | null = null;

  constructor(private maxConcurrent: number = 3) {}

  /**
   * Add a task to the queue and execute when a slot is available
   * @param task - Async task to execute
   * @returns Promise that resolves when task completes
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    // Reject if controller has been aborted
    if (this.aborted) {
      throw new Error("ConcurrencyController has been aborted");
    }

    // Create abort controller if not exists
    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    // Wait if we've reached maximum concurrent operations
    while (this.running >= this.maxConcurrent && !this.aborted) {
      await new Promise<void>((resolve, reject) => {
        this.queue.push({ resolve, reject });
      });
    }

    // Reject if controller was aborted while waiting
    if (this.aborted) {
      throw new Error("ConcurrencyController has been aborted");
    }

    // Execute the task
    this.running++;
    try {
      return await task();
    } finally {
      // Decrement running count and start next task if available
      this.running--;
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    }
  }

  /**
   * Abort all pending tasks and clear the queue
   */
  abort(): void {
    this.aborted = true;
    
    // Abort all tasks using AbortController if available
    if (this.abortController) {
      this.abortController.abort();
    }
    
    while (this.queue.length > 0) {
      const error = new Error("ConcurrencyController has been aborted");
      const next = this.queue.shift();
      if (next) {
        next.reject(error);
      }
    }
  }

  /**
   * Get current number of running operations
   * @returns Number of currently running operations
   */
  getRunningCount(): number {
    return this.running;
  }

  /**
   * Get current queue length
   * @returns Number of pending operations in queue
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if controller has been aborted
   * @returns True if controller has been aborted
   */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Get AbortSignal for current operations
   * @returns AbortSignal that will be triggered when abort() is called
   */
  getAbortSignal(): AbortSignal | null {
    return this.abortController?.signal || null;
  }

  /**
   * Reset the controller to initial state
   */
  reset(): void {
    this.aborted = false;
    this.abortController = null;
    this.queue = [];
    this.running = 0;
  }
}