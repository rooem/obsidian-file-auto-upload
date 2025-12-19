import { Plugin } from "obsidian";
import { StorageConfigModal } from "../components/StorageConfigModal";
import { DEFAULT_SETTINGS } from "./FileAutoUploadSettingTab";
import { EncryptionHelper } from "../common/EncryptionHelper";
import type {
  FileAutoUploadSettings,
  ConfigChangeListener,
  StorageServiceConfig,
  EncryptedData,
} from "../types";
import { logger } from "../common/Logger";
import { StorageServiceType } from "../types";
import { GITHUB_CDN_OPTIONS } from "./StorageServiceSettings";

/**
 * Manages plugin configuration and settings
 * Handles settings updates and notifies listeners of changes
 * Responsible for encrypting/decrypting sensitive configuration data
 */
export class ConfigurationManager {
  private plugin: Plugin;
  private settings: FileAutoUploadSettings;
  private configChangeListeners: Set<ConfigChangeListener> = new Set();

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Load settings from storage and merge with defaults
   * Handles decryption of encrypted settings data
   */
  public async loadSettings(): Promise<void> {
    try {
      const loadedData = (await this.load()) as Partial<FileAutoUploadSettings>;
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...loadedData,
        storageServiceConfig: {
          ...DEFAULT_SETTINGS.storageServiceConfig,
          ...(loadedData?.storageServiceConfig || {}),
        },
      };
    } catch (error) {
      logger.error("ConfigurationManager", "Failed to load settings", error);
    }
  }

  /**
   * Get a copy of current settings
   * Returns a shallow copy to prevent direct mutation of internal settings
   */
  getSettings(): FileAutoUploadSettings {
    return { ...this.settings };
  }

  /**
   * Add a listener for configuration changes
   * Listeners will be notified when settings are updated
   */
  public addConfigChangeListener(listener: ConfigChangeListener): void {
    this.configChangeListeners.add(listener);
  }

  /**
   * Remove all configuration change listeners
   * Used during plugin cleanup
   */
  public removeAllListener(): void {
    this.configChangeListeners.clear();
    logger.debug("ConfigurationManager", "Config change listener all removed");
  }

  /**
   * Show storage configuration modal dialog
   * Allows users to configure storage service settings
   */
  public showStorageConfigModal(): void {
    const modal = new StorageConfigModal(this.plugin);
    modal.open();
  }

  /**
   * Save partial settings updates
   * Optionally notify listeners of changes
   * @param newSettings - Partial settings object with updated values
   * @param needNotify - Whether to notify listeners of the changes
   */
  async saveSettings(
    newSettings: Partial<FileAutoUploadSettings>,
    needNotify?: boolean,
  ): Promise<void> {
    // Deep merge storageServiceConfig to preserve all fields
    if (newSettings.storageServiceConfig) {
      newSettings = {
        ...newSettings,
        storageServiceConfig: {
          ...this.settings.storageServiceConfig,
          ...newSettings.storageServiceConfig,
        },
      };
    }
    this.settings = {
      ...this.settings,
      ...newSettings,
    } as FileAutoUploadSettings;

    await this.saveData(this.settings);

    if (needNotify) {
      this.notifyConfigChange(newSettings);
    }
  }

  /**
   * Get currently configured storage service type
   * @returns Storage service type identifier
   */
  public getCurrentStorageService(): string {
    return this.settings.storageServiceType;
  }

  /**
   * Get current storage service configuration
   * @returns Configuration object for the current storage service
   */
  public getCurrentStorageConfig(): StorageServiceConfig {
    return { ...this.settings.storageServiceConfig };
  }

  /**
   * Get public domain/URL for accessing uploaded files
   * @returns Public domain URL
   */
  public getPublicDomain(): string {
    const config = this.getCurrentStorageConfig();

    // For GitHub with CDN enabled, return the CDN domain
    if (
      this.settings.storageServiceType === StorageServiceType.GITHUB &&
      config.use_cdn
    ) {
      const cdnType = (config.cdn_type as string) || "jsdelivr";
      const template = GITHUB_CDN_OPTIONS[cdnType];
      if (template) {
        // Extract domain from template (e.g., "https://cdn.jsdelivr.net/gh/{repo}@{branch}" -> "https://cdn.jsdelivr.net")
        const match = template.match(/^(https?:\/\/[^/]+)/);
        if (match) {
          return match[1];
        }
      }
    }

    if (config.public_domain) {
      return config.public_domain as string;
    }
    return config.endpoint as string;
  }

  public getAutoUploadFileTypes(): string[] {
    return this.settings.autoUploadFileTypes;
  }

  public isDeleteAfterUpload(): boolean {
    return this.settings.deleteAfterUpload;
  }

  public isSkipDuplicateFiles(): boolean {
    return this.settings.skipDuplicateFiles;
  }

  public isDragAutoUpload(): boolean {
    return this.settings.dragAutoUpload;
  }

  public isClipboardAutoUpload(): boolean {
    return this.settings.clipboardAutoUpload;
  }

  private async load(): Promise<object> {
    const loadedData: unknown = await this.plugin.loadData();

    if (!loadedData || typeof loadedData !== "object") {
      logger.debug("ConfigurationManager", "No data found or invalid format");
      return {};
    }

    if (!("salt" in loadedData) || !("data" in loadedData)) {
      logger.debug(
        "ConfigurationManager",
        "Data not encrypted, returning as-is",
      );
      return loadedData;
    }

    const encryptedData = loadedData as EncryptedData;

    try {
      const vaultName = this.plugin.app.vault.getName();
      const decrypted = await EncryptionHelper.decrypt(
        encryptedData.data,
        this.plugin.manifest.id,
        vaultName,
        this.plugin,
        encryptedData.salt,
      );
      logger.debug("ConfigurationManager", "Data decrypted successfully");
      return JSON.parse(decrypted) as object;
    } catch (error) {
      logger.error("ConfigurationManager", "Failed to decrypt settings", error);
      logger.warn(
        "ConfigurationManager",
        "Old encryption format detected, settings will be reset",
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
    const vaultName = this.plugin.app.vault.getName();
    const salt = this.generateSalt();
    const encrypted = await EncryptionHelper.encrypt(
      jsonString,
      this.plugin.manifest.id,
      vaultName,
      this.plugin,
      salt,
    );

    const savedData: EncryptedData = {
      salt: salt,
      data: encrypted,
    };

    await this.plugin.saveData(savedData);
    logger.debug("ConfigurationManager", "Settings saved successfully");
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

  /**
   * Generate a random salt for encryption
   * @returns Base64 encoded salt string
   */
  private generateSalt(): string {
    const saltArray = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...saltArray));
  }
}
