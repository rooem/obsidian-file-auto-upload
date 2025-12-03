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
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  UploadResult,
  IUploader,
  FileExistsResult,
  FileInfo,
  UploadProgressCallback,
} from "../../types";
import { UploaderType } from "../UploaderType";
import { S3Config } from "../../types";
import { t } from "../../i18n";
import { handleError } from "../../utils/ErrorHandler";
import { logger } from "../../utils/Logger";
import { MULTIPART_UPLOAD_THRESHOLD, generateFileKey} from "../../utils/FileUtils";

export class AmazonS3Uploader implements IUploader {
  protected config: S3Config;
  protected s3Client: S3Client;
  protected type = UploaderType.AMAZON_S3;

  constructor(config: S3Config) {
    this.config = config;
    this.s3Client = this.createS3Client();
  }

  /**
   * Clean up S3 client resources
   * Destroys the client to release connection pools
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

  public checkConnectionConfig(): { success: boolean; error?: string } {
    if (!this.config.endpoint) {
      return { success: false, error: t("error.missingEndpoint") };
    }

    if (!this.config.region) {
      return { success: false, error: t("error.missingRegion") };
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

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
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

      if (result.success && result.key) {
        await this.deleteFile(result.key);
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
   *
   * Automatically uses multipart upload for files larger than 5MB to enable
   * progress tracking. Smaller files use simple upload for better performance.
   *
   * @param file - The file to upload
   * @param key - Optional custom key/path for the file. If not provided, generates a unique key
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Promise resolving to upload result with URL and key
   * @throws {Error} If upload fails
   */
  public async uploadFile(
    file: File,
    key?: string,
    onProgress?: UploadProgressCallback,
  ): Promise<UploadResult> {
    logger.debug("AmazonS3Uploader", "Starting S3 upload", {
      fileName: file.name,
      fileSize: file.size,
      key: key || "auto-generated",
    });

    try {
      const fileKey = key || generateFileKey(file.name);
      const arrayBuffer = await file.arrayBuffer();

      // Use multipart upload for files > 5MB with progress tracking
      if (onProgress && file.size > MULTIPART_UPLOAD_THRESHOLD) {
        logger.debug("AmazonS3Uploader", "Using multipart upload", {
          fileSize: file.size,
        });
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
        logger.debug("AmazonS3Uploader", "Multipart upload completed");
      } else {
        logger.debug("AmazonS3Uploader", "Using simple upload", {
          fileSize: file.size,
        });
        // Use simple PutObject for small files (faster, no progress tracking)
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

        if (onProgress) {
          onProgress(100);
        }
      }

      const publicUrl = this.getPublicUrl(fileKey);
      logger.debug("AmazonS3Uploader", "S3 upload successful", {
        fileKey,
        url: publicUrl,
      });
      return {
        success: true,
        url: publicUrl,
        key: fileKey,
      };
    } catch (error) {
      logger.error("AmazonS3Uploader", "S3 upload failed", error);
      return handleError(error, "error.uploadError");
    }
  }

  public async deleteFile(
    key: string,
  ): Promise<{ success: boolean; error?: string }> {
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

  public async fileExists(key: string): Promise<FileExistsResult> {
    try {
      const headParams = {
        Bucket: this.config.bucket_name,
        Key: key,
      };

      const command = new HeadObjectCommand(headParams);
      await this.s3Client.send(command);

      return { exists: true };
    } catch (error) {
      if (error instanceof Error && error.name === "NotFound") {
        return { exists: false };
      }
      const errorMsg =
        error instanceof Error ? error.message || error.name : String(error);
      return {
        exists: false,
        error: `File existence check error: ${errorMsg || "Unknown error"}`,
      };
    }
  }

  public async getFileInfo(key: string): Promise<{
    success: boolean;
    info?: FileInfo;
    error?: string;
  }> {
    try {
      const headParams = {
        Bucket: this.config.bucket_name,
        Key: key,
      };

      const command = new HeadObjectCommand(headParams);
      const result = await this.s3Client.send(command);

      const fileInfo: FileInfo = {
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType || "application/octet-stream",
      };

      return {
        success: true,
        info: fileInfo,
      };
    } catch (error) {
      logger.error("AmazonS3Uploader", "S3 get file info error", error);
      const errorMsg =
        error instanceof Error ? error.message || error.name : String(error);
      return {
        success: false,
        error: `Get file info error: ${errorMsg || "Unknown error"}`,
      };
    }
  }

  protected getPublicUrl(key: string): string {
    if (this.config.public_url) {
      return `${this.config.public_url.replace(/\/$/, "")}/${key}`;
    }
    const bucketName = this.config.bucket_name;
    return `https://${bucketName}.s3.${this.config.region || "amazonaws.com"}/${key}`;
  }

  protected getEndpoint(): string {
    let endpoint = this.config.endpoint;
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "https://" + endpoint;
    }
    return (endpoint = endpoint.replace(/\/+$/, ""));
  }

}
