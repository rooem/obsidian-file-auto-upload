import { AmazonS3Uploader } from "./AmazonS3Uploader";
import { UploaderType } from "../UploaderType";
import { S3Config } from "../../types";

export class TencentCOSUploader extends AmazonS3Uploader {
  protected type = UploaderType.TENCENT_COS;

  constructor(config: S3Config) {
    super(config);
    this.s3Client = this.createS3Client();
  }

  public getPublicUrl(key: string): string {
    if (this.config.public_domain) {
      return `${this.config.public_domain.replace(/\/$/, "")}/${key}`;
    }

    const endpoint = super.getEndpoint();
    return `https://${this.config.bucket_name}.${endpoint.replace("https://", "")}/${key}`;
  }
}
