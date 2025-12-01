/**
 * Uploader Type Enumeration
 *
 * Defines all supported cloud storage providers.
 * Each type corresponds to a specific uploader implementation.
 *
 * @enum {string}
 */
export enum UploaderType {
  /** Amazon S3 and S3-compatible storage services */
  AMAZON_S3 = "amazon-s3",

  /** Cloudflare R2 storage service */
  CLOUDFLARE_R2 = "cloudflare-r2",

  /** Alibaba Cloud Object Storage Service */
  ALIYUN_OSS = "aliyun-oss",

  /** Tencent Cloud Object Storage */
  TENCENT_COS = "tencent-cos",
}
