/**
 * Uploader related type definitions
 */

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
 * Upload result interface
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
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
 * File existence check result interface
 */
export interface FileExistsResult {
  exists: boolean;
  error?: string;
}

/**
 * Uploader interface - defines methods that all uploaders must implement
 */
export interface IUploader {
  checkConnectionConfig(): { success: boolean; error?: string };

  uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<UploadResult>;

  deleteFile(key: string): Promise<{ success: boolean; error?: string }>;

  fileExists(key: string): Promise<FileExistsResult>;

  fileExistsByPrefix(prefix: string): Promise<UploadResult>;

  getFileInfo(
    key: string,
  ): Promise<{ success: boolean; info?: FileInfo; error?: string }>;

  testConnection(): Promise<{ success: boolean; error?: string }>;

  getPublicUrl(key: string): string;

  /**
   * Clean up resources held by the uploader
   * Optional method for releasing connections, clearing caches, etc.
   */
  dispose?(): void;
}
