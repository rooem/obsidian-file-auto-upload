/**
 * Settings related type definitions
 */

import { StorageServiceConfig } from "./StorageService";

/**
 * Plugin settings interface
 */
export interface FileAutoUploadSettings {
  autoUpload: boolean;
  clipboardAutoUpload: boolean;
  dragAutoUpload: boolean;
  deleteAfterUpload: boolean;
  autoUploadFileTypes: string[];
  skipDuplicateFiles: boolean;
  applyNetworkFiles: boolean;
  storageServiceType: string;
  storageServiceConfig: StorageServiceConfig;
  language: string;
}

/**
 * Configuration change listener type
 */
export type ConfigChangeListener = (
  changedSettings: Partial<FileAutoUploadSettings>,
) => void;

/**
 * Encrypted data structure for secure storage
 */
export interface EncryptedData {
  salt: string;
  data: string;
}
