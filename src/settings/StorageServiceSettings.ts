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
  private static readonly showRegion = new Set<string>([
    StorageServiceType.AMAZON_S3,
    StorageServiceType.ALIYUN_OSS,
    StorageServiceType.TENCENT_COS,
  ]);

  private static readonly fieldConfigs: Record<string, Array<[string, string, string, string?]>> = {
    [StorageServiceType.WEBDAV]: [
      ["settings.username", "settings.username.desc", "access_key_id"],
      ["settings.password", "settings.password.desc", "secret_access_key"],
      ["settings.basePath", "settings.basePath.desc", "bucket_name", "uploads"],
      ["settings.endpoint", "settings.endpoint.desc", "endpoint", "https://xxxxxx.com"],
      ["settings.publicUrl", "settings.publicUrl.webdav.desc", "public_domain", "https://your-domain.com"],
    ],
    s3: [
      ["settings.accessKeyId", "settings.accessKeyId.desc", "access_key_id"],
      ["settings.secretAccessKey", "settings.secretAccessKey.desc", "secret_access_key"],
      ["settings.endpoint", "settings.endpoint.desc", "endpoint", "https://xxxxxx.com"],
      ["settings.bucketName", "settings.bucketName.desc", "bucket_name"],
      ["settings.publicUrl", "settings.publicUrl.desc", "public_domain", "https://your-domain.com"],
    ],
  };

  private static inputStyle = { width: "300px" };

  static render(containerEl: HTMLElement, plugin: FileAutoUploadPlugin, onToggle: () => void): void {
    const settings = plugin.configurationManager.getSettings();
    const isWebdav = settings.storageServiceType === StorageServiceType.WEBDAV;

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
            await plugin.configurationManager.saveSettings({ storageServiceType: value }, true);
            onToggle();
          });
      });

    const fields = this.fieldConfigs[isWebdav ? StorageServiceType.WEBDAV : "s3"];
    for (const [name, desc, key, placeholder] of fields) {
      if (key === "endpoint" && this.showRegion.has(settings.storageServiceType)) {
        this.addTextField(containerEl, plugin, settings, name, desc, key, placeholder);
        new Setting(containerEl)
          .setName(t("settings.region"))
          .setDesc(t("settings.region.desc"))
          .addText((text) =>
            text
              .setValue(this.findRegionVaule(settings))
              .onChange(this.createConfigUpdater(plugin, settings, "region"))
              .inputEl.setCssStyles(this.inputStyle),
          );
      } else {
        this.addTextField(containerEl, plugin, settings, name, desc, key, placeholder);
      }
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

  private static createConfigUpdater(plugin: FileAutoUploadPlugin, settings: FileAutoUploadSettings, key: string) {
    return async (value: string) => {
      await plugin.configurationManager.saveSettings(
        { storageServiceConfig: { ...settings.storageServiceConfig, [key]: value } },
        true,
      );
    };
  }

  private static addTextField(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    settings: FileAutoUploadSettings,
    name: string,
    desc: string,
    configKey: string,
    placeholder?: string,
  ) {
    new Setting(containerEl)
      .setName(t(name))
      .setDesc(t(desc))
      .addText((text) => {
        text
          .setValue((settings.storageServiceConfig[configKey] as string) || "")
          .onChange(this.createConfigUpdater(plugin, settings, configKey))
          .inputEl.setCssStyles(this.inputStyle);
        if (placeholder) text.setPlaceholder(placeholder);
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
