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
    logger.debug("ConfigurationManager", "Config change listener all removed");;
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
    this.settings = { ...this.settings, ...newSettings } as FileAutoUploadSettings;

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
    if(this.getCurrentStorageConfig().public_domain){
      return this.getCurrentStorageConfig().public_domain as string;
    }
    return this.getCurrentStorageConfig().endpoint as string;
  }

  /**
   * Get list of file extensions that should be automatically uploaded
   * @returns Array of file extensions
   */
  public getAutoUploadFileTypes(): string[] {
    return this.settings.autoUploadFileTypes;
  }

  /**
   * Check if files should be deleted after successful upload
   * @returns True if files should be deleted after upload
   */
  public isDeleteAfterUpload(): boolean {
    return this.settings.deleteAfterUpload;
  }

  /**
   * Check if duplicate file uploads should be skipped
   * @returns True if duplicate files should be skipped
   */
  public isSkipDuplicateFiles(): boolean {
    return this.settings.skipDuplicateFiles;
  }

  /**
   * Check if drag-and-drop file uploads are enabled
   * @returns True if drag-and-drop uploads are enabled
   */
  public isDragAutoUpload(): boolean {
    return this.settings.dragAutoUpload;
  }

  /**
   * Check if clipboard paste file uploads are enabled
   * @returns True if clipboard paste uploads are enabled
   */
  public isClipboardAutoUpload(): boolean {
    return this.settings.clipboardAutoUpload;
  }

  /**
   * Load settings from plugin storage
   * Handles decryption of encrypted data if present
   */
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
      const adapter = this.plugin.app.vault.adapter as { basePath?: string };
      const vaultPath = adapter.basePath || this.plugin.app.vault.getName();
      const decrypted = await EncryptionHelper.decrypt(
        encryptedData.data,
        this.plugin.manifest.id,
        vaultPath,
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
    const adapter = this.plugin.app.vault.adapter as { basePath?: string };
    const vaultPath = adapter.basePath || this.plugin.app.vault.getName();

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
