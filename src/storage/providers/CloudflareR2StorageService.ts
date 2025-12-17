import { S3Client } from "@aws-sdk/client-s3";
import { AmazonS3StorageService } from "./AmazonS3StorageService";
import { Result } from "../../types";
import { t } from "../../i18n";

export class CloudflareR2StorageService extends AmazonS3StorageService {

  protected createS3Client(): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.access_key_id,
        secretAccessKey: this.config.secret_access_key,
      },
      forcePathStyle: false,
    });
  }

  public checkConnectionConfig(): Result {
    const commonResult = this.validateCommonConfig();
    if (!commonResult.success) {
      return commonResult;
    }

    if (!this.config.public_domain) {
      return { success: false, error: t("error.missingPublicUrl") };
    }
    return { success: true };
  }

  public getPublicUrl(key: string): string {
    if (this.config.public_domain) {
      return `${this.config.public_domain.replace(/\/$/, "")}/${key}`;
    }
    const endpoint = super.getEndpoint();
    if (endpoint && endpoint.includes("r2.cloudflarestorage.com")) {
      return `https://${this.config.bucket_name}.r2.dev/${key}`;
    }
    return `${endpoint}/${this.config.bucket_name}/${key}`;
  }
}
