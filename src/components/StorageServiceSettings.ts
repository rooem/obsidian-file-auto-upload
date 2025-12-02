import { CustomSetting } from "./CustomSetting";
import FileAutoUploadPlugin from "../main";
import { UploaderType } from "../uploader/UploaderType";
import { UploaderTypeInfo } from "../uploader/UploaderRegistry";
import { t } from "../i18n";
import { Setting } from "obsidian";

/**
 * Storage service settings UI component
 * Renders configuration for cloud storage providers (S3, R2, OSS, COS)
 */
export class StorageServiceSettings {
  /**
   * Render storage service settings section
   * @param containerEl - Container element to render into
   * @param plugin - Plugin instance
   */
  static render(containerEl: HTMLElement, plugin: FileAutoUploadPlugin): void {
    const settings = plugin.configurationManager.getSettings();
    const uploaderTypes = Object.values(UploaderType);
    new CustomSetting(containerEl)
      .setName(t("settings.storage"))
      .setDesc(t("settings.storage.desc"))
      .required()
      .addDropdown((dropdown) => {
        uploaderTypes.forEach((serviceType) => {
          const serviceInfo = UploaderTypeInfo[serviceType];
          if (serviceInfo) {
            dropdown.addOption(serviceType, serviceInfo.serviceName);
          }
        });
        return dropdown
          .setValue(settings.uploaderType)
          .onChange(async (value: string) => {
            regionSetting.required(
              StorageServiceSettings.regionRequired(value as UploaderType),
            );
            await plugin.configurationManager.updateSettings(
              { uploaderType: value as UploaderType },
              true,
            );
          });
      });

    new Setting(containerEl)
      .setName(t("settings.storage.config"))
      .setHeading();
    new CustomSetting(containerEl)
      .setName(t("settings.endpoint"))
      .setDesc(t("settings.endpoint.desc"))
      .required()
      .addText(
        (text) =>
        (text
          .setPlaceholder("https://xxxxxx.com")
          .setValue(settings.uploaderConfig.endpoint as string)
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  endpoint: value,
                },
              },
              true,
            );
          }).inputEl.setCssStyles({ width: "300px" })),
      );

    new CustomSetting(containerEl)
      .setName(t("settings.accessKeyId"))
      .setDesc(t("settings.accessKeyId.desc"))
      .required()
      .addText(
        (text) =>
        (text
          .setValue(settings.uploaderConfig.access_key_id as string)
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  access_key_id: value,
                },
              },
              true,
            );
          }).inputEl.setCssStyles({ width: "300px" })),
      );

    new CustomSetting(containerEl)
      .setName(t("settings.secretAccessKey"))
      .setDesc(t("settings.secretAccessKey.desc"))
      .required()
      .addText(
        (text) =>
        (text
          .setValue(settings.uploaderConfig.secret_access_key as string)
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  secret_access_key: value,
                },
              },
              true,
            );
          }).inputEl.setCssStyles({ width: "300px" })),
      );

    const regionSetting = new CustomSetting(containerEl)
      .setName(t("settings.region"))
      .setDesc(t("settings.region.desc"))
      .required(StorageServiceSettings.regionRequired(settings.uploaderType))
      .addText(
        (text) =>
        (text
          .setValue((settings.uploaderConfig.region as string) || "")
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  region: value,
                },
              },
              true,
            );
          }).inputEl.setCssStyles({ width: "300px" })),
      );

    new CustomSetting(containerEl)
      .setName(t("settings.bucketName"))
      .setDesc(t("settings.bucketName.desc"))
      .required()
      .addText(
        (text) =>
        (text
          .setValue(settings.uploaderConfig.bucket_name as string)
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  bucket_name: value,
                },
              },
              true,
            );
          }).inputEl.setCssStyles({ width: "300px" })),
      );

    new CustomSetting(containerEl)
      .setName(t("settings.publicUrl"))
      .setDesc(t("settings.publicUrl.desc"))
      .required(StorageServiceSettings.publicUrlRequired(settings.uploaderType))
      .addText(
        (text) =>
        (text
          .setPlaceholder("https://your-domain.com")
          .setValue((settings.uploaderConfig.public_url as string) || "")
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  public_url: value,
                },
              },
              true,
            );
          }).inputEl.setCssStyles({ width: "300px" })),
      );

    let testResultEl: HTMLElement;

    new CustomSetting(containerEl).addButton((button) => {
      button.setButtonText(t("settings.testConnection")).onClick(async () => {
        button.setDisabled(true);
        button.setButtonText(t("settings.testing"));
        testResultEl.setText("");
        testResultEl.setCssStyles({fontSize:"15px"});
        try {
          const result = await plugin.uploadServiceManager.testConnection();
          if (result.success) {
            testResultEl.setText(t("settings.testSuccess"));
            testResultEl.setCssStyles({
              color: "green",
            });
          } else {
            testResultEl.setText(
              t("settings.testFailed").replace(
                "{error}",
                result.error || "Unknown error",
              ),
            );
            testResultEl.setCssStyles({
              color: "red",
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          testResultEl.setText(
            t("settings.testError").replace("{error}", errorMessage),
          );
          testResultEl.setCssStyles({
            color: "red",
          });
        } finally {
          button.setDisabled(false);
          button.setButtonText(t("settings.testConnection"));
        }
      });

      const parentElement = button.buttonEl.parentElement;
      if (parentElement) {
        testResultEl = parentElement.createEl("span", {
          text: "",
        });

        testResultEl.setCssStyles({ marginRight: "12px", fontSize: "12px", whiteSpace: "nowrap" });

        parentElement.insertBefore(testResultEl, button.buttonEl);
      }
    });
  }

  /**
   * Check if region field is required for the given uploader type
   */
  private static regionRequired(uploaderType: UploaderType): boolean {
    return (
      uploaderType !== UploaderType.CLOUDFLARE_R2 &&
      uploaderType !== UploaderType.ALIYUN_OSS
    );
  }

  /**
   * Check if public URL field is required for the given uploader type
   */
  private static publicUrlRequired(uploaderType: UploaderType): boolean {
    return uploaderType === UploaderType.CLOUDFLARE_R2;
  }
}
