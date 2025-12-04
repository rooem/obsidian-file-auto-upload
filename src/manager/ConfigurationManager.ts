import { Plugin } from "obsidian";
import { UploaderType } from "../uploader/UploaderType";
import { StorageConfigModal } from "../components/StorageConfigModal";
import { SecureStorage } from "../utils/SecureStorage";
import { DEFAULT_SETTINGS } from "../settings";
import type {
  FileAutoUploadSettings,
  ConfigChangeListener,
  UploaderConfig,
} from "../types";
import { logger } from "../utils/Logger";

/**
 * Manages plugin configuration and settings
 * Handles settings updates and notifies listeners of changes
 */
export class ConfigurationManager {
  private plugin: Plugin;
  private settings: FileAutoUploadSettings;
  private configChangeListeners: Set<ConfigChangeListener> = new Set();
  private secureStorage: SecureStorage;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.secureStorage = new SecureStorage(plugin);
  }

  /**
   * Load current settings (returns a copy)
   */
  public async loadSettings(): Promise<void> {
    try {
      const loadedSettings = await this.secureStorage.load();
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...(typeof loadedSettings === "object" && loadedSettings !== null
          ? loadedSettings
          : {}),
      };
    } catch (error) {
      logger.error("ConfigurationManager", "Failed to load settings", error);
    }
  }

  /**
   * Get current settings (returns a copy)
   */
  getSettings(): FileAutoUploadSettings {
    return { ...this.settings };
  }

  /**
   * Add configuration change listener
   * @param listener - Listener function to call on config changes
   */
  public addConfigChangeListener(listener: ConfigChangeListener): void {
    this.configChangeListeners.add(listener);
  }

  /**
   * Remove configuration change listener
   * @param listener - Listener function to remove
   * @returns true if listener was found and removed
   */
  public removeConfigChangeListener(listener: ConfigChangeListener): boolean {
    const removed = this.configChangeListeners.delete(listener);
    if (removed) {
      logger.debug("ConfigurationManager", "Config change listener removed");
    }
    return removed;
  }

  /**
   * Show storage configuration modal dialog
   */
  public showStorageConfigModal(): void {
    const modal = new StorageConfigModal(this.plugin);
    modal.render();
    modal.getModal().open();
  }

  /**
   * Save plugin settings
   * @param newSettings - Partial settings to update
   * @param saveDataCallback - Optional callback to persist settings
   * @param needNotify - Whether to notify listeners of changes
   */
  async saveSettings(
    newSettings: Partial<FileAutoUploadSettings>,
    needNotify?: boolean,
  ): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    await this.saveData(this.settings);

    if (needNotify) {
      this.notifyConfigChange(newSettings);
    }
  }

  public getCurrentStorageService(): UploaderType {
    return this.settings.uploaderType;
  }

  public getCurrentStorageConfig(): UploaderConfig {
    return { ...this.settings.uploaderConfig };
  }

  public getPublicDomain(): string {
    return this.getCurrentStorageConfig().public_domain as string;
  }

  public getAutoUploadFileTypes(): string[] {
    return this.settings.autoUploadFileTypes;
  }

  /**
   * Save settings with encryption
   * @param data - Settings data to save
   */
  private async saveData(data: unknown): Promise<void> {
    await this.secureStorage.save(data);
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyConfigChange(
    changedSettings: Partial<FileAutoUploadSettings>,
  ): void {
    this.configChangeListeners.forEach((listener) => {
      try {
        listener(changedSettings);
      } catch (error) {
        logger.error(
          "ConfigurationManager",
          "Configuration change listener execution failed",
          error,
        );
      }
    });
  }

}
