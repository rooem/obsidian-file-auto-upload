import { App, MarkdownView } from "obsidian";
import { ConfigurationManager } from "../../settings/ConfigurationManager";
import { logger } from "../../common/Logger";
import { ProcessItem } from "../../types/index";
import { ConcurrencyController } from "../../common/ConcurrencyController";
import { isImageExtension } from "../../common/FileUtils";
import { StorageServiceManager } from "../../storage/StorageServiceManager";


/**
 * Base class for all event handlers
 * Provides queue management for asynchronous operations with concurrency control
 */
export abstract class BaseEventHandler {
  protected app: App;
  protected configurationManager: ConfigurationManager;
  protected storageServiceManager: StorageServiceManager;
  protected concurrencyController: ConcurrencyController;

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

  /**
   * Escape special regex characters in string
   * @param str - String to escape
   * @returns Escaped string for use in regex
   */
  protected escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Generate placeholder suffix for progress indication
   * @param id - Process item ID
   * @param statusText - Status text to display
   * @returns Placeholder suffix string
   */
  protected getPlaceholderSuffix(id: string, statusText: string): string {
    return `⏳${statusText}<!--${id}-->`;
  }

  /**
   * Replace markdown link URL with placeholder
   * @param url - Original URL to replace
   * @param placeholder - Placeholder text to insert
   * @returns True if replacement was successful
   */
  protected replaceUrlWithPlaceholder(
    url: string,
    placeholder: string,
  ): boolean {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return false;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const escapedUrl = this.escapeRegExp(url);
    const linkRegex = new RegExp(`(!?\\[[^\\]]*\\])\\(${escapedUrl}\\)`);
    const match = linkRegex.exec(content);

    if (match) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      const replacement = match[1] + placeholder;
      editor.replaceRange(
        replacement,
        editor.offsetToPos(startOffset),
        editor.offsetToPos(endOffset)
      );
      return true;
    }
    return false;
  }

  /**
   * Replace placeholder marker with final markdown content
   * @param id - Process item ID to find placeholder for
   * @param markdown - Final markdown content to insert
   * @param fileName - Optional file name for image detection
   */
  protected replacePlaceholderWithMarkdown(
    id: string,
    markdown: string,
    fileName?: string,
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const content = editor.getValue();
    const marker = `<!--${id}-->`;
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      const lastLine = editor.lastLine();
      editor.replaceRange(markdown + "\n", { line: lastLine + 1, ch: 0 });
      return;
    }

    const linkStartIndex = content.lastIndexOf("[", markerIndex);
    if (linkStartIndex === -1) {
      const lastLine = editor.lastLine();
      editor.replaceRange(markdown + "\n", { line: lastLine + 1, ch: 0 });
      return;
    }

    const hasImagePrefix =
      linkStartIndex > 0 && content[linkStartIndex - 1] === "!";
    let finalMarkdown = markdown;

    if (hasImagePrefix && markdown.startsWith("!")) {
      finalMarkdown = markdown.substring(1);
    } else if (!hasImagePrefix && fileName) {
      const extension = fileName.split(".").pop()?.toLowerCase() || "";
      if (isImageExtension(extension) && !markdown.startsWith("!")) {
        finalMarkdown = `!${markdown}`;
      }
    }

    const startPos = editor.offsetToPos(linkStartIndex);
    const endPos = editor.offsetToPos(markerIndex + marker.length);
    editor.replaceRange(finalMarkdown, startPos, endPos);
  }
}
