import { Plugin, MarkdownView, Menu, Editor } from "obsidian";
import { FileAutoUploadSettingTab } from "./settings/FileAutoUploadSettingTab";
import { ConfigurationManager } from "./settings/ConfigurationManager";
import { UploadServiceManager } from "./uploader/UploaderManager";
import { EventHandlerManager } from "./handler/EventHandlerManager";
import { StatusBar } from "./components/StatusBar";
import { logger } from "./utils/Logger";

/**
 * Main plugin class for file auto upload functionality
 */
export default class FileAutoUploadPlugin extends Plugin {
  public configurationManager!: ConfigurationManager;
  public uploadServiceManager!: UploadServiceManager;
  public eventHandlerManager!: EventHandlerManager;
  public statusBarManager!: StatusBar;

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
   * Checks for pending uploads and waits for completion
   */
  onunload(): void {
    logger.debug("FileAutoUploadPlugin", "Plugin unloading started");
    this.eventHandlerManager.dispose();
    this.uploadServiceManager.dispose();
    this.statusBarManager.dispose();
    logger.debug("FileAutoUploadPlugin", "Plugin unloading successfully");
  }

  /**
   * Initialize configuration and service managers
   * Creates event handlers for clipboard, drag-drop, and delete operations
   */
  private async initialize(): Promise<void> {
    this.configurationManager = new ConfigurationManager(this);
    await this.configurationManager.loadSettings();

    this.uploadServiceManager = new UploadServiceManager(
      this.configurationManager,
    );

    this.statusBarManager = new StatusBar(this);

    this.eventHandlerManager = new EventHandlerManager(
      this.app,
      this.configurationManager,
      this.uploadServiceManager,
      this.statusBarManager,
    );
  }

  /**
   * Register Obsidian workspace events
   * Handles paste, drop, and context menu events
   */
  private registerEvents(): void {
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (event: ClipboardEvent, editor: Editor, view: MarkdownView) => {
          void this.eventHandlerManager.handleClipboardPaste(
            event,
            editor,
            view,
          );
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        (event: DragEvent, editor: Editor, view: MarkdownView) => {
          void this.eventHandlerManager.handleFileDrop(event, editor, view);
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
  }
}
