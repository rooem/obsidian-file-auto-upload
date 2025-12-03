import { S3Client } from "@aws-sdk/client-s3";
import { UploaderType } from "../UploaderType";
import { S3Config } from "../../types";
import { AmazonS3Uploader } from "./AmazonS3Uploader";
import { t } from "../../i18n";

export class AliyunOSSUploader extends AmazonS3Uploader {
  protected type = UploaderType.ALIYUN_OSS;

  constructor(config: S3Config) {
    super(config);
    this.s3Client = this.createS3Client();
  }

  protected createS3Client(): S3Client {
    return new S3Client({
      region: this.config.region || "auto",
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.access_key_id,
        secretAccessKey: this.config.secret_access_key,
      },
      forcePathStyle: false,
    });
  }

  public checkConnectionConfig(): { success: boolean; error?: string } {
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

  public getPublicUrl(key: string): string {
    if (this.config.public_domain) {
      return `${this.config.public_domain.replace(/\/$/, "")}/${key}`;
    }

    const endpoint = super.getEndpoint();
    return `https://${this.config.bucket_name}.${endpoint.replace("https://", "")}/${key}`;
  }
}
