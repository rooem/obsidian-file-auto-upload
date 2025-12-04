/**
 * Uploader Registry
 *
 * Central registry that maps uploader types to their implementations.
 * This allows the system to dynamically instantiate the correct uploader
 * based on the user's configuration.
 *
 * @module UploaderRegistry
 */

import { AmazonS3Uploader } from "./providers/AmazonS3Uploader";
import { AliyunOSSUploader } from "./providers/AliyunOSSUploader";
import { TencentCOSUploader } from "./providers/TencentCOSUploader";
import { CloudflareR2Uploader } from "./providers/CloudflareR2Uploader";

/**
 * Supported uploader types
 */
export const UploaderType = {
  AMAZON_S3: "amazon-s3",
  CLOUDFLARE_R2: "cloudflare-r2",
  ALIYUN_OSS: "aliyun-oss",
  TENCENT_COS: "tencent-cos",
} as const;

/**
 * Registry mapping uploader types to their implementation classes
 */
export const UploaderTypeInfo = {
  [UploaderType.AMAZON_S3]: {
    clazz: AmazonS3Uploader,
    serviceName: "Amazon S3",
  },
  [UploaderType.CLOUDFLARE_R2]: {
    clazz: CloudflareR2Uploader,
    serviceName: "Cloudflare R2",
  },
  [UploaderType.ALIYUN_OSS]: {
    clazz: AliyunOSSUploader,
    serviceName: "Aliyun OSS",
  },
  [UploaderType.TENCENT_COS]: {
    clazz: TencentCOSUploader,
    serviceName: "Tencent COS",
  },
} as const;
