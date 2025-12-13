/**
 * StorageService Registry
 *
 * Central registry that maps storage service types to their implementations.
 * This allows the system to dynamically instantiate the correct storage service
 * based on the user's configuration.
 *
 * @module StorageServiceRegistry
 */

import { AmazonS3StorageService } from "./providers/AmazonS3StorageService";
import { AliyunOSSStorageService } from "./providers/AliyunOSSStorageService";
import { TencentCOSStorageService } from "./providers/TencentCOSStorageService";
import { CloudflareR2StorageService } from "./providers/CloudflareR2StorageService";
import { WebdavStorageService } from "./providers/WebdavStorageService";
import type { IStorageService, StorageServiceConfig } from "../types";

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
 * Registry mapping storage service types to their implementation classes
 */
export const StorageServiceTypeInfo: Record<
  string,
  { clazz: StorageServiceConstructor; serviceName: string }
> = {
  [StorageServiceType.AMAZON_S3]: {
    clazz: AmazonS3StorageService,
    serviceName: "Amazon S3",
  },
  [StorageServiceType.CLOUDFLARE_R2]: {
    clazz: CloudflareR2StorageService,
    serviceName: "Cloudflare R2",
  },
  [StorageServiceType.ALIYUN_OSS]: {
    clazz: AliyunOSSStorageService,
    serviceName: "Aliyun OSS",
  },
  [StorageServiceType.TENCENT_COS]: {
    clazz: TencentCOSStorageService,
    serviceName: "Tencent COS",
  },
  [StorageServiceType.WEBDAV]: {
    clazz: WebdavStorageService,
    serviceName: "WebDAV",
  },
};
