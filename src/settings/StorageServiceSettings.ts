import { Setting } from "obsidian";
import FileAutoUploadPlugin from "../main";
import { StorageServiceType, StorageServiceTypeInfo } from "../storage/StorageServiceRegistry";
import { t } from "../i18n";
import type { FileAutoUploadSettings } from "../types";

/**
 * Storage service settings UI component
 * Renders configuration for cloud storage providers (S3, R2, OSS, COS)
 */
export class StorageServiceSettings {
  private static createConfigUpdater(
    plugin: FileAutoUploadPlugin,
    key: string,
  ) {
    return async (value: string) => {
      const current = plugin.configurationManager.getSettings();
      await plugin.configurationManager.saveSettings(
        {
          storageServiceConfig: { ...current.storageServiceConfig, [key]: value },
        },
        true,
      );
    };
  }

  static render(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    onToggle: () => void,
  ): void {
    const settings = plugin.configurationManager.getSettings();
    const inputStyle = { width: "300px" };

    new Setting(containerEl)
      .setName(t("settings.storage"))
      .setDesc(t("settings.storage.desc"))
      .addDropdown((dropdown) => {
        Object.entries(StorageServiceTypeInfo).forEach(([key, info]) => {
          dropdown.addOption(key, info.serviceName);
        });
        return dropdown
          .setValue(settings.storageServiceType)
          .onChange(async (value: string) => {
            await plugin.configurationManager.saveSettings(
              { storageServiceType: value },
              true,
            );
            onToggle();
          });
      });

    // Show different fields based on uploader type
    if (settings.storageServiceType === StorageServiceType.WEBDAV) {
      new Setting(containerEl)
        .setName(t("settings.username"))
        .setDesc(t("settings.username.desc"))
        .addText((text) =>
          text
            .setValue(settings.storageServiceConfig.username as string)
            .onChange(this.createConfigUpdater(plugin, "username"))
            .inputEl.setCssStyles(inputStyle),
        );

      new Setting(containerEl)
        .setName(t("settings.password"))
        .setDesc(t("settings.password.desc"))
        .addText((text) =>
          text
            .setValue(settings.storageServiceConfig.password as string)
            .onChange(this.createConfigUpdater(plugin, "password"))
            .inputEl.setCssStyles(inputStyle),
        );

      new Setting(containerEl)
        .setName(t("settings.basePath"))
        .setDesc(t("settings.basePath.desc"))
        .addText((text) =>
          text
            .setPlaceholder("uploads")
            .setValue((settings.storageServiceConfig.base_path as string) || "")
            .onChange(this.createConfigUpdater(plugin, "base_path"))
            .inputEl.setCssStyles(inputStyle),
        );

      new Setting(containerEl)
        .setName(t("settings.publicUrl"))
        .setDesc(t("settings.publicUrl.desc"))
        .addText((text) =>
          text
            .setPlaceholder("https://your-domain.com")
            .setValue((settings.storageServiceConfig.public_domain as string) || "")
            .onChange(this.createConfigUpdater(plugin, "public_domain"))
            .inputEl.setCssStyles(inputStyle),
        );
    } else {
      new Setting(containerEl)
        .setName(t("settings.accessKeyId"))
        .setDesc(t("settings.accessKeyId.desc"))
        .addText((text) =>
          text
            .setValue(settings.storageServiceConfig.access_key_id as string)
            .onChange(this.createConfigUpdater(plugin, "access_key_id"))
            .inputEl.setCssStyles(inputStyle),
        );

      new Setting(containerEl)
        .setName(t("settings.secretAccessKey"))
        .setDesc(t("settings.secretAccessKey.desc"))
        .addText((text) =>
          text
            .setValue(settings.storageServiceConfig.secret_access_key as string)
            .onChange(this.createConfigUpdater(plugin, "secret_access_key"))
            .inputEl.setCssStyles(inputStyle),
        );
    }

    new Setting(containerEl)
      .setName(t("settings.endpoint"))
      .setDesc(t("settings.endpoint.desc"))
      .addText((text) =>
        text
          .setPlaceholder("https://xxxxxx.com")
          .setValue(settings.storageServiceConfig.endpoint as string)
          .onChange(async (value: string) => {
            await this.createConfigUpdater(plugin, "endpoint")(value);
          })
          .inputEl.setCssStyles(inputStyle),
      );

    // Show region and bucket only for S3-compatible services
    if (settings.storageServiceType !== StorageServiceType.WEBDAV) {
      if (settings.storageServiceType !== StorageServiceType.CLOUDFLARE_R2) {
        new Setting(containerEl)
          .setName(t("settings.region"))
          .setDesc(t("settings.region.desc"))
          .addText((text) =>
            text
              .setValue(StorageServiceSettings.findRegionVaule(settings))
              .onChange(this.createConfigUpdater(plugin, "region"))
              .inputEl.setCssStyles(inputStyle),
          );
      }

      new Setting(containerEl)
        .setName(t("settings.bucketName"))
        .setDesc(t("settings.bucketName.desc"))
        .addText((text) =>
          text
            .setValue(settings.storageServiceConfig.bucket_name as string)
            .onChange(this.createConfigUpdater(plugin, "bucket_name"))
            .inputEl.setCssStyles(inputStyle),
        );
    }

    if (settings.storageServiceType !== StorageServiceType.WEBDAV) {
      new Setting(containerEl)
        .setName(t("settings.publicUrl"))
        .setDesc(t("settings.publicUrl.desc"))
        .addText((text) =>
          text
            .setPlaceholder("https://your-domain.com")
            .setValue((settings.storageServiceConfig.public_domain as string) || "")
            .onChange(this.createConfigUpdater(plugin, "public_domain"))
            .inputEl.setCssStyles(inputStyle),
        );
    }


    let testResultEl: HTMLElement;
    new Setting(containerEl).addButton((button) => {
      button.setButtonText(t("settings.testConnection")).onClick(async () => {
        button.setDisabled(true);
        button.setButtonText(t("settings.testing"));
        testResultEl.setText("");
        testResultEl.setCssStyles({ fontSize: "15px" });
        try {
          const result = await plugin.eventHandlerManager.testConnection();
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
    if (!settings.storageServiceConfig || !settings.storageServiceConfig.endpoint) {
      return "";
    }

    const endpoint = settings.storageServiceConfig.endpoint as string;

    if (settings.storageServiceType === StorageServiceType.ALIYUN_OSS) {
      const ossRegex = /(?:oss-)?([a-z]+-[a-z]+-?\d*)(?:\.oss)?\.aliyuncs\.com/;
      const match = endpoint.match(ossRegex);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    }

    if (settings.storageServiceType === StorageServiceType.TENCENT_COS) {
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
