import { App, PluginSettingTab, Setting } from "obsidian";
import FileAutoUploadPlugin from "../main";
import { AutoUploadSettings } from "./AutoUploadSettings";
import { StorageServiceSettings } from "./StorageServiceSettings";
import { DeveloperSettings } from "./DeveloperSettings";
import { t } from "../i18n";
import { FileAutoUploadSettings,StorageServiceType } from "../types";

// Re-export for backward compatibility
export type { FileAutoUploadSettings } from "../types";

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: FileAutoUploadSettings = {
  autoUpload: true,
  clipboardAutoUpload: true,
  dragAutoUpload: true,
  skipDuplicateFiles: false,
  deleteAfterUpload: false,
  autoUploadFileTypes: ["jpg", "jpeg", "png", "gif", "pdf", "mp4"],
  applyNetworkFiles: true,
  storageServiceType: StorageServiceType.AMAZON_S3,
  storageServiceConfig: {
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

  constructor(app: App, plugin: FileAutoUploadPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    const titleSetting = new Setting(containerEl)
      .setName(t("settings.plugin"))
      .setHeading();

    StorageServiceSettings.render(containerEl, this.plugin, () =>
      this.display(),
    );

    AutoUploadSettings.render(containerEl, this.plugin);

    DeveloperSettings.render(
      containerEl,
      titleSetting.nameEl,
      this.plugin,
      () => this.display(),
    );
  }
}
