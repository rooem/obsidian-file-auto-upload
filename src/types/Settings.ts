/**
 * Settings related type definitions
 */

import { UploaderType } from "../uploader/UploaderType";
import { UploaderConfig } from "./Uploader";

/**
 * Plugin settings interface
 */
export interface FileAutoUploadSettings {
  autoUpload: boolean;
  clipboardAutoUpload: boolean;
  dragAutoUpload: boolean;
  autoUploadFileTypes: string[];
  applyNetworkFiles: boolean;
  uploaderType: UploaderType;
  uploaderConfig: UploaderConfig;
  language: string;
}

/**
 * Configuration change listener type
 */
export type ConfigChangeListener = (
  changedSettings: Partial<FileAutoUploadSettings>,
) => void;
