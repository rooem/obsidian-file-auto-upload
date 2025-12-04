import { App } from "obsidian";
import { ConfigurationManager } from "../manager/ConfigurationManager";
import { logger } from "../utils/Logger";
import { ProcessItem } from "../types/index";

/**
 * Base class for all event handlers
 * Provides queue management for asynchronous operations
 */
export abstract class BaseEventHandler<T = unknown> {
  protected app: App;
  protected configurationManager: ConfigurationManager;
  protected processingQueue: Array<ProcessItem<T>> = [];
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
   * Clear the processing queue
   */
  public clearQueue(): void {
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Add items to processing queue and start processing
   * @param queue - Array of items to process
   */
  protected addToProcessingQueue(
    queue: Array<ProcessItem<T>>,
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
      const processItem = this.processingQueue.shift();
      if (processItem) {
        // Process item concurrently without waiting
        this.processItem(processItem).catch((error) => {
          logger.error("BaseEventHandler processing item:", error);
        });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single queue item - must be implemented by subclasses
   * @param item - The item to process
   */
  protected abstract processItem(
    processItem: ProcessItem<T>
  ): Promise<void>;

  /**
   * Extract uploaded file links from text - can be overridden by subclasses
   * @param text - Text to extract links from
   * @returns Array of file URLs
   */
  protected extractUploadedFileLinks(text: string): string[] {
    const publicDomain = this.configurationManager.getPublicDomain();

    if (!publicDomain) {
      return [];
    }

    const escapedUrl = publicDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`!?\\[[^\\]]*\\]\\((${escapedUrl}[^)]+)\\)`, "g");
    const matches = text.matchAll(linkRegex);

    return Array.from(matches, (match) => match[1]);
  }
}
