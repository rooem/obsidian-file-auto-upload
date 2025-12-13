/**
 * Central type definitions export
 */

// StorageService types
export type {
  Result,
  UploadData,
  StorageServiceConfig,
  S3Config,
  WebdavConfig,
  UploadProgressCallback,
  FileInfo,
  IStorageService,
} from "./StorageService";

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
