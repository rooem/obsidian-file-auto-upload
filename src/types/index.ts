/**
 * Central type definitions export
 */

// Uploader types
export type {
  UploaderConfig,
  S3Config,
  UploadResult,
  UploadProgressCallback,
  FileInfo,
  FileExistsResult,
  IUploader,
} from "./Uploader";

// Settings types
export type { FileAutoUploadSettings, ConfigChangeListener } from "./Settings";

// Error types
export { ErrorCode, UploadError } from "./Error";

export type { AppError, ValidationResult } from "./Error";
