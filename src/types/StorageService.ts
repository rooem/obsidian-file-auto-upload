/**
 * Supported storage service types
 */
export const StorageServiceType = {
  AMAZON_S3: "amazon-s3",
  CLOUDFLARE_R2: "cloudflare-r2",
  ALIYUN_OSS: "aliyun-oss",
  TENCENT_COS: "tencent-cos",
  WEBDAV: "webdav",
} as const;

/**
 * StorageService class constructor type
 */
export type StorageServiceConstructor = new (
  config: StorageServiceConfig,
) => IStorageService;

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
 * Base storage service configuration interface
 */
export interface StorageServiceConfig {
  [key: string]: unknown;
}

/**
 * S3 configuration interface
 */
export interface S3Config extends StorageServiceConfig {
  endpoint: string;
  region?: string;
  access_key_id: string;
  secret_access_key: string;
  bucket_name: string;
  public_domain?: string;
}

/**
 * WebDAV configuration interface
 * Uses S3 field names for unified storage: access_key_id=username, secret_access_key=password, bucket_name=base_path
 */
export interface WebdavConfig extends StorageServiceConfig {
  endpoint: string;
  access_key_id: string; // WebDAV username
  secret_access_key: string; // WebDAV password
  bucket_name?: string; // WebDAV base_path
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
 * StorageService interface - defines methods that all storage services must implement
 */
export interface IStorageService {
  checkConnectionConfig(): Result;

  uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>>;

  deleteFile(key: string): Promise<Result>;

  fileExistsByPrefix(key: string): Promise<Result<UploadData>>;

  testConnection(): Promise<Result>;

  getPublicUrl(key: string): string;

  /**
   * Clean up resources held by the storage service
   * Optional method for releasing connections, clearing caches, etc.
   */
  dispose?(): void;
}
