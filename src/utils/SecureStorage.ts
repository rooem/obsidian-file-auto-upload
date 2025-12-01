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
  encrypted: boolean;
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
    const encrypted = await EncryptionHelper.encrypt(
      jsonString,
      this.plugin.manifest.id,
      vaultPath,
      this.plugin,
    );

    // Load existing data to preserve salt
    const existingData = (await this.plugin.loadData()) as {
      _encryption_salt?: string;
    } | null;
    const salt =
      existingData &&
      typeof existingData === "object" &&
      "_encryption_salt" in existingData
        ? (existingData._encryption_salt as string)
        : this.generateSalt();

    await this.plugin.saveData({
      encrypted: true,
      data: encrypted,
      _encryption_salt: salt,
    });

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
  async load(): Promise<unknown> {
    const data: unknown = await this.plugin.loadData();

    if (!data || typeof data !== "object") {
      logger.info("SecureStorage", "No data found or invalid format");
      return {};
    }

    if (!("encrypted" in data) || !("data" in data)) {
      logger.info("SecureStorage", "Data not encrypted, returning as-is");
      return data;
    }

    const encryptedData = data as EncryptedData;

    if (encryptedData.encrypted) {
      try {
        const vaultPath =
          (this.app.vault.adapter as VaultAdapter).basePath ||
          this.app.vault.getName();
        const decrypted = await EncryptionHelper.decrypt(
          encryptedData.data,
          this.plugin.manifest.id,
          vaultPath,
          this.plugin,
        );
        logger.info("SecureStorage", "Data decrypted successfully");
        return JSON.parse(decrypted) as unknown;
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
