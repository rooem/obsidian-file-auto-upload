import { App } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { logger } from "../utils/Logger";
import { ProcessItem } from "../types/index";
import { ConcurrencyController } from "../utils/ConcurrencyController";

/**
 * Base class for all event handlers
 * Provides queue management for asynchronous operations with concurrency control
 */
export abstract class BaseEventHandler<T = unknown> {
  protected app: App;
  protected configurationManager: ConfigurationManager;
  protected concurrencyController: ConcurrencyController;

  constructor(app: App, configurationManager: ConfigurationManager, maxConcurrent: number = 3) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.concurrencyController = new ConcurrencyController(maxConcurrent);
  }

  /**
   * Get current processing status
   * @returns Running count and queue length from concurrency controller
   */
  public getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.concurrencyController.getQueueLength(),
      isProcessing: this.concurrencyController.getRunningCount() > 0,
    };
  }

  /**
   * Dispose the handler and abort all pending tasks
   */
  public dispose(): void {
    this.concurrencyController.abort();
  }

  /**
   * Process items immediately with concurrency control
   * @param items - Array of items to process
   */
  protected processItems(
    items: Array<ProcessItem<T>>,
  ): void {
    for (const item of items) {
      this.concurrencyController.run(() => this.processItem(item)).catch((error) => {
        logger.error("BaseEventHandler processing item:", error);
      });
    }
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
