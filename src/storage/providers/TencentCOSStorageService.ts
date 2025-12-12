import { AmazonS3StorageService } from "./AmazonS3StorageService";
import { StorageServiceType } from "../StorageServiceRegistry";
import { Result } from "../../types";

export class TencentCOSStorageService extends AmazonS3StorageService {
  protected type = StorageServiceType.TENCENT_COS;

  public checkConnectionConfig(): Result {
    return this.validateCommonConfig();
  }

  public getPublicUrl(key: string): string {
    return this.getBucketSubdomainUrl(key);
  }
}
