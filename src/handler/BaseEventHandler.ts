import { App } from "obsidian";
import { ConfigurationManager } from "../manager/ConfigurationManager";
import { logger } from "../utils/Logger";

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
      this.processQueue();
    }
  }

  /**
   * Process all items in the queue sequentially
   */
  protected processQueue(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift();
      if (item) {
        // Process item concurrently without waiting
        this.processItem(item, this.processingQueue.length).catch((error) => {
          logger.error("BaseEventHandler processing item:", error);
        });
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
