import { S3Client } from "@aws-sdk/client-s3";
import { UploaderType } from "../UploaderRegistry";
import { AmazonS3Uploader } from "./AmazonS3Uploader";

export class AliyunOSSUploader extends AmazonS3Uploader {
  protected type = UploaderType.ALIYUN_OSS;

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
    return this.validateCommonConfig();
  }

  protected getPublicUrl(key: string): string {
    if (this.config.public_domain) {
      return `${this.config.public_domain.replace(/\/$/, "")}/${key}`;
    }

    const endpoint = super.getEndpoint();
    return `https://${this.config.bucket_name}.${endpoint.replace("https://", "")}/${key}`;
  }
}
