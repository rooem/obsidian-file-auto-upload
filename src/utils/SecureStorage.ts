/**
 * Secure storage wrapper for plugin settings
 * Provides simple encrypt/decrypt interface with plugin-specific security
 */
import { App, Plugin } from "obsidian";
import { EncryptionHelper } from "./EncryptionHelper";
import { logger } from "./Logger";

interface VaultAdapter {
  basePath?: string;
}

interface EncryptedData {
  salt: string;
  data: string;
}

export class SecureStorage {
  private plugin: Plugin;
  private app: App;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  /**
   * Save data with encryption
   * @param data - Data to save
   */
  async save(data: unknown): Promise<void> {
    const jsonString = JSON.stringify(data);
    const vaultPath =
      (this.app.vault.adapter as VaultAdapter).basePath ||
      this.app.vault.getName();
    
    // Generate a new salt for each encryption
    const salt = this.generateSalt();
    const encrypted = await EncryptionHelper.encrypt(
      jsonString,
      this.plugin.manifest.id,
      vaultPath,
      this.plugin,
      salt
    );

    const savedData: EncryptedData = {
      salt: salt,
      data: encrypted,
    };

    await this.plugin.saveData(savedData);

    logger.info("SecureStorage", "Data saved successfully");
  }

  /**
   * Generate a new encryption salt
   */
  private generateSalt(): string {
    const saltArray = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...saltArray));
  }

  /**
   * Load and decrypt data
   * @returns Decrypted data or empty object if failed
   */
  async load(): Promise<Object> {
    const loadedData = await this.plugin.loadData();

    if (!loadedData || typeof loadedData !== "object") {
      logger.info("SecureStorage", "No data found or invalid format");
      return {};
    }

    if (!("salt" in loadedData) || !("data" in loadedData)) {
      logger.info("SecureStorage", "Data not encrypted, returning as-is");
      return loadedData;
    }

    const encryptedData = loadedData as EncryptedData;

    if (encryptedData.salt) {
      try {
        const vaultPath =
          (this.app.vault.adapter as VaultAdapter).basePath ||
          this.app.vault.getName();
        const decrypted = await EncryptionHelper.decrypt(
          encryptedData.data,
          this.plugin.manifest.id,
          vaultPath,
          this.plugin,
          encryptedData.salt
        );
        logger.info("SecureStorage", "Data decrypted successfully");
        return JSON.parse(decrypted) as Object;
      } catch (error) {
        logger.error("SecureStorage", "Failed to decrypt settings", error);
        logger.warn(
          "SecureStorage",
          "This may be due to old encryption format. Settings will be reset.",
        );
        return {};
      }
    }

    return {};
  }
}