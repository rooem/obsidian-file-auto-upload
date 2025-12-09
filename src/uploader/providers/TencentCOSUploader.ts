import { AmazonS3Uploader } from "./AmazonS3Uploader";
import { UploaderType } from "../UploaderRegistry";
import { Result } from "../../types";

export class TencentCOSUploader extends AmazonS3Uploader {
  protected type = UploaderType.TENCENT_COS;

  public checkConnectionConfig(): Result {
    return this.validateCommonConfig();
  }

  public getPublicUrl(key: string): string {
    return this.getBucketSubdomainUrl(key);
  }
}
