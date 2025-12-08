import { AmazonS3Uploader } from "./AmazonS3Uploader";
import { UploaderType } from "../UploaderRegistry";

export class TencentCOSUploader extends AmazonS3Uploader {
  protected type = UploaderType.TENCENT_COS;

  public checkConnectionConfig(): { success: boolean; error?: string } {
    return this.validateCommonConfig();
  }

  public getPublicUrl(key: string): string {
    return this.getBucketSubdomainUrl(key);
  }
}
