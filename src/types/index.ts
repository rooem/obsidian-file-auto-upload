/**
 * Central type definitions export
 */

// Uploader types
export type {
  Result,
  UploadData,
  UploaderConfig,
  S3Config,
  UploadProgressCallback,
  FileInfo,
  IUploader,
} from "./Uploader";

// Settings types
export type {
  FileAutoUploadSettings,
  ConfigChangeListener,
  EncryptedData,
} from "./Settings";

// Error types
export { ErrorCode, UploadError } from "./Error";

export type { AppError } from "./Error";

export { EventType } from "./Event";

export type {
  ProcessItem,
  TextProcessItem,
  FileProcessItem,
  DeleteProcessItem,
  DownloadProcessItem,
} from "./Event";
