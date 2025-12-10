/**
 * Amazon S3 Uploader
 *
 * Provides upload functionality for Amazon S3 and S3-compatible storage services.
 * Supports multipart uploads with progress tracking for large files (>5MB).
 *
 * @implements {IUploader}
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  Result,
  UploadData,
  IUploader,
  FileInfo,
  UploadProgressCallback,
  UploaderConfig,
  S3Config,
} from "../../types";
import { UploaderType } from "../UploaderRegistry";
import { t } from "../../i18n";
import { handleError } from "../../utils/ErrorHandler";
import { logger } from "../../utils/Logger";
import {
  MULTIPART_UPLOAD_THRESHOLD,
  generateFileKey,
} from "../../utils/FileUtils";

export class AmazonS3Uploader implements IUploader {
  protected config: S3Config;
  protected s3Client: S3Client;
  protected type: string = UploaderType.AMAZON_S3;

  constructor(config: UploaderConfig) {
    this.config = config as S3Config;
    this.s3Client = this.createS3Client();
  }

  protected validateCommonConfig(): Result {
    if (!this.config.endpoint) {
      return { success: false, error: t("error.missingEndpoint") };
    }
    if (!this.config.access_key_id) {
      return { success: false, error: t("error.missingAccessKeyId") };
    }
    if (!this.config.secret_access_key) {
      return { success: false, error: t("error.missingSecretAccessKey") };
    }
    if (!this.config.bucket_name) {
      return { success: false, error: t("error.missingBucketName") };
    }
    return { success: true };
  }

  /**
   * Clean up S3 client resources
   */
  public dispose(): void {
    if (this.s3Client) {
      this.s3Client.destroy();
      logger.debug("AmazonS3Uploader", "S3 client disposed");
    }
  }

  protected createS3Client(): S3Client {
    return new S3Client({
      region: this.config.region || "auto",
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.access_key_id,
        secretAccessKey: this.config.secret_access_key,
      },
      forcePathStyle: true,
    });
  }

  public checkConnectionConfig(): Result {
    const commonResult = this.validateCommonConfig();
    if (!commonResult.success) {
      return commonResult;
    }

    if (!this.config.region) {
      return { success: false, error: t("error.missingRegion") };
    }
    return { success: true };
  }

  public async testConnection(): Promise<Result> {
    const checkResult = this.checkConnectionConfig();
    if (!checkResult.success) {
      return { success: false, error: checkResult.error };
    }

    try {
      const testContent = `${this.type} connection test - ${new Date().toISOString()}`;
      const testFile = new File([testContent], "test.txt", {
        type: "text/plain",
      });

      const result = await this.uploadFile(
        testFile,
        "test/connection-test.txt",
      );

      if (result.success && result.data?.key) {
        await this.deleteFile(result.data.key);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || "Connection test failed",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Upload a file to S3 storage
   * Uses multipart upload for files > 5MB with progress tracking
   */
  public async uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<Result<UploadData>> {
    try {
      const fileKey = key || generateFileKey(file.name);
      const arrayBuffer = await file.arrayBuffer();

      // Use multipart upload for files > 5MB with progress tracking
      if (onProgress && file.size > MULTIPART_UPLOAD_THRESHOLD) {
        const upload = new Upload({
          client: this.s3Client,
          params: {
            Bucket: this.config.bucket_name,
            Key: fileKey,
            Body: Buffer.from(arrayBuffer),
            ContentType: file.type,
          },
        });

        upload.on(
          "httpUploadProgress",
          (progress: { loaded?: number; total?: number }) => {
            if (progress.loaded && progress.total) {
              const percentage = (progress.loaded / progress.total) * 100;
              onProgress(percentage);
            }
          },
        );

        await upload.done();
      } else {
        const uploadParams = {
          Bucket: this.config.bucket_name,
          Key: fileKey,
          Body: Buffer.from(arrayBuffer),
          ContentType: file.type,
          ContentLength: file.size,
        };

        const command = new PutObjectCommand(uploadParams);
        const result = await this.s3Client.send(command);

        if (result.$metadata.httpStatusCode !== 200) {
          return {
            success: false,
            error: `${t("error.uploadFailed")}: HTTP ${result.$metadata.httpStatusCode}`,
          };
        }

        onProgress?.(100);
      }

      const publicUrl = this.getPublicUrl(fileKey);
      logger.debug("AmazonS3Uploader", "Upload successful", {
        fileName: file.name,
        url: publicUrl,
      });
      return {
        success: true,
        data: { url: publicUrl, key: fileKey },
      };
    } catch (error) {
      logger.error("AmazonS3Uploader", "Upload failed", {
        fileName: file.name,
        error,
      });
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(key: string): Promise<Result> {
    logger.debug("AmazonS3Uploader", "Starting S3 delete", { key });

    try {
      const deleteParams = {
        Bucket: this.config.bucket_name,
        Key: key,
      };

      const command = new DeleteObjectCommand(deleteParams);
      const result = await this.s3Client.send(command);

      if (result.$metadata.httpStatusCode === 204) {
        logger.debug("AmazonS3Uploader", "S3 delete successful", { key });
        return { success: true };
      } else {
        logger.error("AmazonS3Uploader", "S3 delete failed", {
          key,
          statusCode: result.$metadata.httpStatusCode,
        });
        return {
          success: false,
          error: `${t("error.deleteFailed")}: HTTP ${result.$metadata.httpStatusCode}`,
        };
      }
    } catch (error) {
      logger.error("AmazonS3Uploader", "S3 delete error", { key, error });
      return handleError(error, "error.deleteError");
    }
  }

  public async fileExistsByPrefix(key: string): Promise<Result<UploadData>> {
    try {
      const prefix = key?.substring(0, key.indexOf("_"));
      if (!prefix) {
        return { success: false };
      }

      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket_name,
        Prefix: prefix,
        MaxKeys: 1,
      });

      const response: ListObjectsV2CommandOutput =
        await this.s3Client.send(command);
      if (
        response &&
        response.Contents &&
        response.Contents.length > 0 &&
        response.Contents[0].Key
      ) {
        return {
          success: true,
          data: {
            url: this.getPublicUrl(response.Contents[0].Key),
            key: response.Contents[0].Key,
          },
        };
      }

      return { success: false };
    } catch (error) {
      logger.error(
        "AmazonS3Uploader",
        "check file exists by prefix error",
        error,
      );
      return handleError(error, "error.uploadError");
    }
  }

  public getPublicUrl(key: string): string {
    if (this.config.public_domain) {
      return `${this.config.public_domain.replace(/\/$/, "")}/${key}`;
    }
    const bucketName = this.config.bucket_name;
    return `https://${bucketName}.s3.${this.config.region || "amazonaws.com"}/${key}`;
  }

  /**
   * Get public URL using bucket subdomain format (for OSS/COS compatible services)
   */
  protected getBucketSubdomainUrl(key: string): string {
    if (this.config.public_domain) {
      return `${this.config.public_domain.replace(/\/$/, "")}/${key}`;
    }
    const endpoint = this.getEndpoint();
    return `https://${this.config.bucket_name}.${endpoint.replace("https://", "")}/${key}`;
  }

  protected getEndpoint(): string {
    let endpoint = this.config.endpoint;
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "https://" + endpoint;
    }
    return (endpoint = endpoint.replace(/\/+$/, ""));
  }
}
