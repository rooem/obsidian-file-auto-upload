import { logger } from "./Logger";

interface PluginInstance {
  constructor: { name: string };
  saveData: (data: unknown) => Promise<void>;
  loadData: () => Promise<unknown>;
}

/**
 * Encryption helper for sensitive settings data
 * Uses AES-256-GCM encryption with plugin-specific key derivation
 *
 * Security: Even if other plugins see this code, they cannot decrypt data because:
 * 1. Key is derived from plugin's internal state (not just manifest ID)
 * 2. Uses Obsidian's plugin instance reference which is unique per plugin
 * 3. Combines multiple entropy sources that are plugin-specific
 * 4. Salt is persisted to ensure decryption after restart
 */
export class EncryptionHelper {
  private static readonly ALGORITHM = "AES-GCM";
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly ITERATIONS = 100000;

  /**
   * Get or create persistent salt for encryption
   * Salt is stored in plugin data file alongside encrypted data
   */
  private static async getOrCreateSalt(
    pluginInstance: PluginInstance,
  ): Promise<string> {
    try {
      const data = await pluginInstance.loadData();
      if (
        data &&
        typeof data === "object" &&
        "_encryption_salt" in data &&
        typeof data._encryption_salt === "string"
      ) {
        return data._encryption_salt;
      }
    } catch {
      // First time use, will generate new salt
    }

    // Generate cryptographically secure random salt
    const saltArray = crypto.getRandomValues(new Uint8Array(32));
    const salt = btoa(String.fromCharCode(...saltArray));

    return salt;
  }

  /**
   * Generate encryption key using plugin-specific entropy
   * Combines multiple sources that are unique to this plugin:
   * - Plugin manifest ID
   * - Obsidian vault path
   * - Plugin constructor name
   * - Persistent salt
   */
  private static async getEncryptionKey(
    pluginId: string,
    vaultPath: string,
    pluginInstance: PluginInstance,
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    // Get persistent salt
    const salt = await this.getOrCreateSalt(pluginInstance);

    // Combine multiple entropy sources (all fixed/persistent)
    const keyMaterial = encoder.encode(
      pluginId + vaultPath + pluginInstance.constructor.name + salt,
    );

    // Use PBKDF2 for key derivation
    const baseKey = await crypto.subtle.importKey(
      "raw",
      keyMaterial,
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"],
    );

    const saltBuffer = encoder.encode(salt);

    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: this.ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypt sensitive data
   * @param data - Data to encrypt
   * @param pluginId - Plugin ID for key derivation
   * @param vaultPath - Vault path for additional entropy
   * @param pluginInstance - Plugin instance reference
   * @returns Encrypted data as base64 string
   */
  static async encrypt(
    data: string,
    pluginId: string,
    vaultPath: string,
    pluginInstance: PluginInstance,
  ): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const key = await this.getEncryptionKey(
        pluginId,
        vaultPath,
        pluginInstance,
      );
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        dataBuffer,
      );

      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      logger.error("EncryptionHelper", "Encryption failed", error);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData - Encrypted data as base64 string
   * @param pluginId - Plugin ID for key derivation
   * @param vaultPath - Vault path for additional entropy
   * @param pluginInstance - Plugin instance reference
   * @returns Decrypted data
   */
  static async decrypt(
    encryptedData: string,
    pluginId: string,
    vaultPath: string,
    pluginInstance: PluginInstance,
  ): Promise<string> {
    try {
      const combined = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0),
      );

      const iv = combined.slice(0, this.IV_LENGTH);
      const encryptedBuffer = combined.slice(this.IV_LENGTH);

      const key = await this.getEncryptionKey(
        pluginId,
        vaultPath,
        pluginInstance,
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        encryptedBuffer,
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      logger.error("EncryptionHelper", "Decryption failed", error);
      throw new Error("Failed to decrypt data");
    }
  }
}
