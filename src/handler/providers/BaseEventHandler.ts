import { App } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { logger } from "../../common/Logger";
import { ProcessItem } from "../../types/index";
import { ConcurrencyController } from "../../common/ConcurrencyController";
import { StorageServiceManager } from "../../storage/StorageServiceManager";
import { ContentReplacer } from "../../common/ContentReplacer";

/**
 * Base class for all event handlers
 * Provides queue management for asynchronous operations with concurrency control
 */
export abstract class BaseEventHandler {
  protected app: App;
  protected configurationManager: ConfigurationManager;
  protected storageServiceManager: StorageServiceManager;
  protected concurrencyController: ConcurrencyController;
  protected contentReplacer: ContentReplacer;

  constructor(
    app: App,
    configurationManager: ConfigurationManager,
    storageServiceManager: StorageServiceManager,
    maxConcurrent: number = 3,
  ) {
    this.app = app;
    this.configurationManager = configurationManager;
    this.storageServiceManager = storageServiceManager;
    this.concurrencyController = new ConcurrencyController(maxConcurrent);
    this.contentReplacer = new ContentReplacer(app);
  }

  /**
   * Get current queue status
   * @returns Object with queue length and processing status
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
