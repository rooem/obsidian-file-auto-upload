import { S3Client } from "@aws-sdk/client-s3";
import { AmazonS3StorageService } from "./AmazonS3StorageService";
import { Result ,StorageServiceType} from "../../types";

export class AliyunOSSStorageService extends AmazonS3StorageService {
  protected type = StorageServiceType.ALIYUN_OSS;

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

  public checkConnectionConfig(): Result {
    return this.validateCommonConfig();
  }

  public getPublicUrl(key: string): string {
    return this.getBucketSubdomainUrl(key);
  }
}
