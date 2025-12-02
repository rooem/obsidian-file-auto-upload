import { App, PluginSettingTab} from "obsidian";
import FileAutoUploadPlugin from "./main";
import { UploaderType } from "./uploader/UploaderType";
import { AutoUploadSettings } from "./components/AutoUploadSettings";
import { StorageServiceSettings } from "./components/StorageServiceSettings";
import { DeveloperSettings } from "./components/DeveloperSettings";
import { t } from "./i18n";
import type { FileAutoUploadSettings } from "./types";

// Re-export for backward compatibility
export type { FileAutoUploadSettings } from "./types";

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: FileAutoUploadSettings = {
  autoUpload: true,
  clipboardAutoUpload: true,
  dragAutoUpload: true,
  autoUploadFileTypes: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "svg",
    "ico",
    "tiff",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "mp4",
  ],
  applyNetworkFiles: true,
  uploaderType: UploaderType.AMAZON_S3,
  uploaderConfig: {
    endpoint: "",
    region: "",
    access_key_id: "",
    secret_access_key: "",
    bucket_name: "",
    public_url: "",
  },
  language: "en",
};

/**
 * Plugin settings tab class
 */
export class FileAutoUploadSettingTab extends PluginSettingTab {
  plugin: FileAutoUploadPlugin;

  /**
   * Create a new settings tab
   * @param app - The Obsidian app instance
   * @param plugin - The plugin instance
   */
  constructor(app: App, plugin: FileAutoUploadPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Render the settings tab UI
   * Creates storage service and auto-upload configuration sections
   */
  display() {
    const { containerEl } = this;
    containerEl.empty();

    const titleEl = containerEl.createEl("h5", { text: t("settings.plugin") });

    DeveloperSettings.setupTripleClickListener(titleEl, () => this.display());

    StorageServiceSettings.render(containerEl, this.plugin);
    AutoUploadSettings.render(containerEl, this.plugin);

    if (DeveloperSettings.isEnabled()) {
      DeveloperSettings.render(containerEl, this.plugin, () => this.display());
    }
  }
}
