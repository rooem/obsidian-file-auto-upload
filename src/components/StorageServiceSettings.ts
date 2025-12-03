import { Setting } from "obsidian";
import FileAutoUploadPlugin from "../main";
import { UploaderType } from "../uploader/UploaderType";
import { UploaderTypeInfo } from "../uploader/UploaderRegistry";
import { t } from "../i18n";
import type { FileAutoUploadSettings } from "../types";

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
  static render(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    onToggle: () => void,
  ): void {
    const settings = plugin.configurationManager.getSettings();
    const uploaderTypes = Object.values(UploaderType);
    new Setting(containerEl)
      .setName(t("settings.storage"))
      .setDesc(t("settings.storage.desc"))
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
            await plugin.configurationManager.updateSettings(
              { uploaderType: value as UploaderType },
              true,
            );
            onToggle();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.accessKeyId"))
      .setDesc(t("settings.accessKeyId.desc"))
      .addText((text) =>
        text
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
          })
          .inputEl.setCssStyles({ width: "300px" }),
      );

    new Setting(containerEl)
      .setName(t("settings.secretAccessKey"))
      .setDesc(t("settings.secretAccessKey.desc"))
      .addText((text) =>
        text
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
          })
          .inputEl.setCssStyles({ width: "300px" }),
      );

    new Setting(containerEl)
      .setName(t("settings.endpoint"))
      .setDesc(t("settings.endpoint.desc"))
      .addText((text) =>
        text
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
            onToggle();
          })
          .inputEl.setCssStyles({ width: "300px" }),
      );

    if (settings.uploaderType !== UploaderType.CLOUDFLARE_R2) {
      new Setting(containerEl)
        .setName(t("settings.region"))
        .setDesc(t("settings.region.desc"))
        .addText((text) =>
          text
            .setValue(StorageServiceSettings.findRegionVaule(settings))
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
            })
            .inputEl.setCssStyles({ width: "300px" }),
        );
    }

    new Setting(containerEl)
      .setName(t("settings.bucketName"))
      .setDesc(t("settings.bucketName.desc"))
      .addText((text) =>
        text
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
          })
          .inputEl.setCssStyles({ width: "300px" }),
      );

    new Setting(containerEl)
      .setName(t("settings.publicUrl"))
      .setDesc(t("settings.publicUrl.desc"))
      .addText((text) =>
        text
          .setPlaceholder("https://your-domain.com")
          .setValue((settings.uploaderConfig.public_domain as string) || "")
          .onChange(async (value: string) => {
            const currentSettings = plugin.configurationManager.getSettings();
            await plugin.configurationManager.updateSettings(
              {
                uploaderConfig: {
                  ...currentSettings.uploaderConfig,
                  public_domain: value,
                },
              },
              true,
            );
          })
          .inputEl.setCssStyles({ width: "300px" }),
      );

    let testResultEl: HTMLElement;
    new Setting(containerEl).addButton((button) => {
      button.setButtonText(t("settings.testConnection")).onClick(async () => {
        button.setDisabled(true);
        button.setButtonText(t("settings.testing"));
        testResultEl.setText("");
        testResultEl.setCssStyles({ fontSize: "15px" });
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

        testResultEl.setCssStyles({
          marginRight: "12px",
          fontSize: "12px",
          whiteSpace: "nowrap",
        });

        parentElement.insertBefore(testResultEl, button.buttonEl);
      }
    });
  }

  private static findRegionVaule(settings: FileAutoUploadSettings): string {
    if (!settings.uploaderConfig || !settings.uploaderConfig.endpoint) {
      return "";
    }

    const endpoint = settings.uploaderConfig.endpoint as string;

    if (settings.uploaderType === UploaderType.ALIYUN_OSS) {
      const ossRegex = /(?:oss-)?([a-z]+-[a-z]+-?\d*)(?:\.oss)?\.aliyuncs\.com/;
      const match = endpoint.match(ossRegex);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    }

    if (settings.uploaderType === UploaderType.TENCENT_COS) {
      const cosRegex = /cos\.([a-z]+-[a-z]+-?\d*)\.myqcloud\.com/;
      const match = endpoint.match(cosRegex);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    }

    return "";
  }
}
