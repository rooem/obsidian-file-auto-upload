import { AmazonS3StorageService } from "./AmazonS3StorageService";
import { Result } from "../../types";

export class TencentCOSStorageService extends AmazonS3StorageService {

  public checkConnectionConfig(): Result {
    return this.validateCommonConfig();
  }

  public getPublicUrl(key: string): string {
    return this.getBucketSubdomainUrl(key);
  }
}
