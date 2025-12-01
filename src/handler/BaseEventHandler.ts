import { App } from "obsidian";
import { ConfigurationManager } from "../manager/ConfigurationManager";

/**
 * Base class for all event handlers
 * Provides queue management for asynchronous operations
 */
export abstract class BaseEventHandler<T = unknown> {
  protected app: App;
  protected configurationManager: ConfigurationManager;
  protected processingQueue: Array<{ type: string; value: T }> = [];
  protected isProcessing: boolean = false;

  constructor(app: App, configurationManager: ConfigurationManager) {
    this.app = app;
    this.configurationManager = configurationManager;
  }

  /**
   * Get current queue status
   * @returns Queue length and processing state
   */
  public getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Add items to processing queue and start processing
   * @param queue - Array of items to process
   */
  protected addToProcessingQueue(
    queue: Array<{ type: string; value: T }>,
  ): void {
    this.processingQueue.push(...queue);

    if (!this.isProcessing) {
      void this.processQueue();
    }
  }

  /**
   * Process all items in the queue sequentially
   */
  protected async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    let index = 0;
    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift();
      if (item) {
        await this.processItem(item, index);
        index++;
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single queue item - must be implemented by subclasses
   * @param item - The item to process
   * @param index - The index of the item in the original queue
   */
  protected abstract processItem(
    item: { type: string; value: T },
    index?: number,
  ): Promise<void>;
}
