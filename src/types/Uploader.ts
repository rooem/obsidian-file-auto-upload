/**
 * Uploader related type definitions
 */

/**
 * Generic result type for operations
 */
export interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Upload data returned on successful upload
 */
export interface UploadData {
  url: string;
  key: string;
}

/**
 * Base uploader configuration interface
 */
export interface UploaderConfig {
  [key: string]: unknown;
}

/**
 * S3 configuration interface
 */
export interface S3Config extends UploaderConfig {
  endpoint: string;
  region?: string;
  access_key_id: string;
  secret_access_key: string;
  bucket_name: string;
  public_domain?: string;
}

/**
 * Upload progress callback type
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * File information interface
 */
export interface FileInfo {
  size: number;
  lastModified: Date;
  contentType: string;
}

/**
 * Uploader interface - defines methods that all uploaders must implement
 */
export interface IUploader {
  checkConnectionConfig(): Result;

  uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>>;

  deleteFile(key: string): Promise<Result>;

  fileExists(key: string): Promise<Result<boolean>>;

  fileExistsByPrefix(prefix: string): Promise<Result<UploadData>>;

  getFileInfo(key: string): Promise<Result<FileInfo>>;

  testConnection(): Promise<Result>;

  getPublicUrl(key: string): string;

  /**
   * Clean up resources held by the uploader
   * Optional method for releasing connections, clearing caches, etc.
   */
  dispose?(): void;
}
