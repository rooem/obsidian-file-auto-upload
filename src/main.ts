import { Plugin, MarkdownView, Menu, Editor, TFile } from "obsidian";
import { FileAutoUploadSettingTab } from "./settings/FileAutoUploadSettingTab";
import { ConfigurationManager } from "./settings/ConfigurationManager";
import { EventHandlerManager } from "./handler/EventHandlerManager";
import { StatusBar } from "./components/StatusBar";
import { createWebdavImageExtension, WebdavImageLoaderService } from "./components/WebdavImageLoader";
import { logger } from "./common/Logger";

/**
 * Main plugin class for file auto upload functionality
 * This class serves as the central coordinator for all plugin features
 */
export default class FileAutoUploadPlugin extends Plugin {
  public configurationManager!: ConfigurationManager;
  public eventHandlerManager!: EventHandlerManager;
  private webdavImageLoader?: WebdavImageLoaderService;

  /**
   * Plugin initialization - called when plugin is loaded
   * Sets up managers, event handlers, and settings tab
   */
  async onload() {
    logger.debug("FileAutoUploadPlugin", "Plugin loading started");
    await this.initialize();
    this.registerEvents();
    this.addSettingTab(new FileAutoUploadSettingTab(this.app, this));
    logger.debug("FileAutoUploadPlugin", "Plugin loaded successfully");
  }

  /**
   * Plugin cleanup - called when plugin is unloaded
   * Disposes all managers and releases resources
   */
  onunload(): void {
    logger.debug("FileAutoUploadPlugin", "Plugin unloading started");
    this.configurationManager.removeAllListener();
    this.eventHandlerManager.dispose();
    this.webdavImageLoader?.destroy();
    logger.debug("FileAutoUploadPlugin", "Plugin unloaded successfully");
  }

  /**
   * Initialize configuration, upload service, status bar and event handler managers
   * Creates instances of all required managers for plugin operation
   */
  private async initialize(): Promise<void> {
    this.configurationManager = new ConfigurationManager(this);
    await this.configurationManager.loadSettings();

    const statusBar = new StatusBar(this);
    this.eventHandlerManager = new EventHandlerManager(
      this.app,
      this.configurationManager,
      statusBar
    );

    // Register WebDAV image loader extension
    const { extension, loader } = createWebdavImageExtension(this.configurationManager);
    this.webdavImageLoader = loader;
    this.registerEditorExtension(extension);
  }

  /**
   * Register Obsidian workspace events
   * Handles paste, drop, and context menu events
   * These events trigger the file handling workflow
   */
  private registerEvents(): void {
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (event: ClipboardEvent, editor: Editor, view: MarkdownView) => {
          this.eventHandlerManager.handleClipboardPaste(event, editor, view)
            .catch((e) => logger.error("FileAutoUploadPlugin", "Paste handler error", e));
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        (event: DragEvent, editor: Editor, view: MarkdownView) => {
          this.eventHandlerManager.handleFileDrop(event, editor, view)
            .catch((e) => logger.error("FileAutoUploadPlugin", "Drop handler error", e));
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, editor: Editor, view: MarkdownView) => {
          this.eventHandlerManager.handleEditorContextMenu(menu, editor, view);
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
        this.eventHandlerManager.handleFileMenu(menu, file);
      }),
    );
  }
}
