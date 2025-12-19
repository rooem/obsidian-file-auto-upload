import { Plugin, MarkdownView, Menu, Editor, TFile, TFolder } from "obsidian";
import { FileAutoUploadSettingTab } from "./settings/FileAutoUploadSettingTab";
import { ConfigurationManager } from "./settings/ConfigurationManager";
import { EventHandlerManager } from "./handler/EventHandlerManager";
import { StatusBar } from "./components/StatusBar";
import { logger } from "./common/Logger";

/**
 * Main plugin class for file auto upload functionality
 * This class serves as the central coordinator for all plugin features
 */
export default class FileAutoUploadPlugin extends Plugin {
  public configurationManager!: ConfigurationManager;
  public eventHandlerManager!: EventHandlerManager;

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
      statusBar,
    );
  }

  private registerEvents(): void {
    this.registerEvent(
      this.app.workspace.on(
        "editor-paste",
        (event: ClipboardEvent, editor: Editor, view: MarkdownView) => {
          this.eventHandlerManager
            .handleClipboardPaste(event, editor, view)
            .catch((e) =>
              logger.error("FileAutoUploadPlugin", "Paste handler error", e),
            );
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on(
        "editor-drop",
        (event: DragEvent, editor: Editor, view: MarkdownView) => {
          this.eventHandlerManager
            .handleFileDrop(event, editor, view)
            .catch((e) =>
              logger.error("FileAutoUploadPlugin", "Drop handler error", e),
            );
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
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile | TFolder) => {
        if (file instanceof TFolder) {
          this.eventHandlerManager.handleFolderMenu(menu, file);
        } else {
          this.eventHandlerManager.handleFileMenu(menu, file);
        }
      }),
    );

    // Register WebDAV image loader extension
    this.registerEditorExtension(
      this.eventHandlerManager.createEditorExtension(),
    );

    // Register markdown post processor for reading view and PDF export
    this.registerMarkdownPostProcessor(
      this.eventHandlerManager.createMarkdownPostProcessor(),
    );
  }
}
