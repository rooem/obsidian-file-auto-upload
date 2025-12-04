import { AmazonS3Uploader } from "./AmazonS3Uploader";
import { UploaderType } from "../UploaderRegistry";

export class TencentCOSUploader extends AmazonS3Uploader {
  protected type = UploaderType.TENCENT_COS;

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
