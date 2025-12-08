/**
 * Settings related type definitions
 */

import { UploaderConfig } from "./Uploader";

/**
 * Plugin settings interface
 */
export interface FileAutoUploadSettings {
  autoUpload: boolean;
  clipboardAutoUpload: boolean;
  dragAutoUpload: boolean;
  autoUploadFileTypes: string[];
  skipDuplicateFiles: boolean;
  applyNetworkFiles: boolean;
  uploaderType: string;
  uploaderConfig: UploaderConfig;
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
