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
      this.processQueue().catch(error=>logger.error("BaseEventHandler addToProcessingQueue:",error));
    }
  }

  /**
   * Process all items in the queue sequentially
   */
  protected async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // 处理所有当前及新增的项目，直到队列为空一段时间
    while (this.processingQueue.length > 0) {
      // 取出一个项目进行处理
      const item = this.processingQueue.shift();
      if (item) {
        // 并发处理该项目，不等待完成
        this.processItem(item, this.processingQueue.length).catch(error => {
          logger.error('BaseEventHandler processing item:', error);
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
