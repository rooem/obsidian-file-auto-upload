import { App } from "obsidian";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { logger } from "../utils/Logger";
import { ProcessItem } from "../types/index";
import { ConcurrencyController } from "../utils/ConcurrencyController";

/**
 * Base class for all event handlers
 * Provides queue management for asynchronous operations with concurrency control
 */
export abstract class BaseEventHandler {
  protected app: App;
  protected configurationManager: ConfigurationManager;
  protected concurrencyController: ConcurrencyController;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    maxConcurrent: number = 3,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.concurrencyController = new ConcurrencyController(maxConcurrent);
  }

  /**
   * Get current queue status
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
  protected processItems(items: ProcessItem[]): void {
    for (const item of items) {
      this.concurrencyController
        .run(() => this.processItem(item))
        .catch((error: Error) => {
          logger.error("BaseEventHandler processing item:", error.message);
        });
    }
  }

  /**
   * Process a single item - must be implemented by subclasses
   */
  protected abstract processItem(processItem: ProcessItem): Promise<void>;
}
