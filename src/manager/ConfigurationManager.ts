import { Plugin } from "obsidian";
import { StorageConfigModal } from "../components/StorageConfigModal";
import { DEFAULT_SETTINGS } from "../settings";
import { EncryptionHelper } from "../utils/EncryptionHelper";
import type {
  FileAutoUploadSettings,
  ConfigChangeListener,
  UploaderConfig,
  EncryptedData,
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

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Load current settings (returns a copy)
   */
  public async loadSettings(): Promise<void> {
    try {
      const loadedSettings = await this.load();
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...(loadedSettings !== null? loadedSettings: {}),
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

  public getCurrentStorageService(): string {
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

  private async load(): Promise<object> {
    const loadedData: unknown = await this.plugin.loadData();

    if (!loadedData || typeof loadedData !== "object") {
      logger.debug("SecureStorage", "No data found or invalid format");
      return {};
    }

    if (!("salt" in loadedData) || !("data" in loadedData)) {
      logger.debug("SecureStorage", "Data not encrypted, returning as-is");
      return loadedData;
    }

    const encryptedData = loadedData as EncryptedData;

    try {
      const vaultPath =
        (this.plugin.app.vault.adapter as any).basePath ||
        this.plugin.app.vault.getName();
      const decrypted = await EncryptionHelper.decrypt(
        encryptedData.data,
        this.plugin.manifest.id,
        vaultPath,
        this.plugin,
        encryptedData.salt,
      );
      logger.debug("SecureStorage", "Data decrypted successfully");
      return JSON.parse(decrypted) as object;
    } catch (error) {
      logger.error("SecureStorage", "Failed to decrypt settings", error);
      logger.warn(
        "SecureStorage",
        "This may be due to old encryption format. Settings will be reset.",
      );
      return {};
    }
  }

  /**
   * Save settings with encryption
   * @param data - Settings data to save
   */
  private async saveData(data: unknown): Promise<void> {
    const jsonString = JSON.stringify(data);
    const vaultPath =
      (this.plugin.app.vault.adapter as any).basePath ||
      this.plugin.app.vault.getName();

    // Generate a new salt for each encryption
    const salt = this.generateSalt();
    const encrypted = await EncryptionHelper.encrypt(
      jsonString,
      this.plugin.manifest.id,
      vaultPath,
      this.plugin,
      salt,
    );

    const savedData: EncryptedData = {
      salt: salt,
      data: encrypted,
    };

    await this.plugin.saveData(savedData);

    logger.debug("SecureStorage", "Data saved successfully");
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

  private generateSalt(): string {
    const saltArray = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...saltArray));
  }

}
