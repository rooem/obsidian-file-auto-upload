import { Setting } from "obsidian";
import FileAutoUploadPlugin from "../main";
import { t } from "../i18n";
import { FileAutoUploadSettings, StorageServiceType } from "../types";
import { StorageServiceTypeInfo } from "../storage/StorageServiceManager";
import { PasswordSetting } from "../components/PasswordSetting";

interface FieldConfig {
  name: string;
  desc: string;
  key: string;
  placeholder?: string;
  isPassword?: boolean;
  defaultValue?: string;
}

export class StorageServiceSettings {
  private static readonly INPUT_STYLE = { width: "300px" };

  private static readonly REGION_PROVIDERS = new Set<string>([
    StorageServiceType.AMAZON_S3,
    StorageServiceType.ALIYUN_OSS,
    StorageServiceType.TENCENT_COS,
  ]);

  private static readonly FIELD_CONFIGS: Record<string, FieldConfig[]> = {
    [StorageServiceType.WEBDAV]: [
      {
        name: "settings.username",
        desc: "settings.username.desc",
        key: "access_key_id",
      },
      {
        name: "settings.password",
        desc: "settings.password.desc",
        key: "secret_access_key",
        isPassword: true,
      },
      {
        name: "settings.endpoint",
        desc: "settings.endpoint.desc",
        key: "endpoint",
        placeholder: "https://service-domain.com",
      },
      {
        name: "settings.basePath",
        desc: "settings.basePath.desc",
        key: "bucket_name",
        placeholder: "upload",
      },
      {
        name: "settings.publicUrl",
        desc: "settings.publicUrl.webdav.desc",
        key: "public_domain",
        placeholder: "https://public-domain.com",
      },
    ],
    [StorageServiceType.GITHUB]: [
      {
        name: "settings.github.token",
        desc: "settings.github.token.desc",
        key: "secret_access_key",
        isPassword: true,
      },
      {
        name: "settings.github.repo",
        desc: "settings.github.repo.desc",
        key: "bucket_name",
        placeholder: "owner/repo",
      },
      {
        name: "settings.github.branch",
        desc: "settings.github.branch.desc",
        key: "branch",
        placeholder: "main",
        defaultValue: "main",
      },
      {
        name: "settings.github.path",
        desc: "settings.github.path.desc",
        key: "path",
        placeholder: "upload",
      },
      {
        name: "settings.publicUrl",
        desc: "settings.github.publicUrl.desc",
        key: "public_domain",
        placeholder: "https://cdn.jsdelivr.net/gh/owner/repo@main",
        defaultValue: "https://cdn.jsdelivr.net",
      },
    ],
    s3: [
      {
        name: "settings.accessKeyId",
        desc: "settings.accessKeyId.desc",
        key: "access_key_id",
      },
      {
        name: "settings.secretAccessKey",
        desc: "settings.secretAccessKey.desc",
        key: "secret_access_key",
        isPassword: true,
      },
      {
        name: "settings.endpoint",
        desc: "settings.endpoint.desc",
        key: "endpoint",
        placeholder: "https://service-domain.com",
      },
      {
        name: "settings.bucketName",
        desc: "settings.bucketName.desc",
        key: "bucket_name",
      },
      {
        name: "settings.publicUrl",
        desc: "settings.publicUrl.desc",
        key: "public_domain",
        placeholder: "https://service-domain.com",
      },
    ],
  };

  static render(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    onToggle: () => void,
  ): void {
    const settings = plugin.configurationManager.getSettings();
    const isWebdav = settings.storageServiceType === StorageServiceType.WEBDAV;

    this.renderStorageDropdown(containerEl, plugin, onToggle);
    this.renderFields(containerEl, plugin, settings, isWebdav);
    this.renderTestButton(containerEl, plugin);
  }

  private static renderStorageDropdown(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    onToggle: () => void,
  ): void {
    new Setting(containerEl)
      .setName(t("settings.storage"))
      .setDesc(t("settings.storage.desc"))
      .addDropdown((dropdown) => {
        Object.entries(StorageServiceTypeInfo).forEach(([key, info]) =>
          dropdown.addOption(key, info.serviceName),
        );
        return dropdown
          .setValue(
            plugin.configurationManager.getSettings().storageServiceType,
          )
          .onChange((value) => {
            void plugin.configurationManager.saveSettings(
              { storageServiceType: value },
              true,
            ).then(() => onToggle());
          });
      });
  }

  private static renderFields(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    settings: FileAutoUploadSettings,
    isWebdav: boolean,
  ): void {
    const serviceType = settings.storageServiceType;
    const fields =
      this.FIELD_CONFIGS[serviceType] ||
      this.FIELD_CONFIGS[isWebdav ? StorageServiceType.WEBDAV : "s3"];
    for (const field of fields) {
      this.addField(containerEl, plugin, settings, field);
      if (
        field.key === "endpoint" &&
        this.REGION_PROVIDERS.has(serviceType)
      ) {
        this.addField(containerEl, plugin, settings, {
          name: "settings.region",
          desc: "settings.region.desc",
          key: "region",
        });
      }
    }
  }

  private static renderTestButton(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
  ): void {
    let resultEl: HTMLElement;
    new Setting(containerEl).addButton((btn) => {
      btn.setButtonText(t("settings.testConnection")).onClick(async () => {
        btn.setDisabled(true).setButtonText(t("settings.testing"));
        resultEl.setText("");
        try {
          const { success, error } =
            await plugin.eventHandlerManager.testConnection();
          resultEl.setText(
            success
              ? t("settings.testSuccess")
              : t("settings.testFailed").replace("{error}", error || "Unknown"),
          );
          resultEl.style.color = success ? "green" : "red";
        } catch (e) {
          resultEl.setText(
            t("settings.testError").replace(
              "{error}",
              e instanceof Error ? e.message : String(e),
            ),
          );
          resultEl.style.color = "red";
        } finally {
          btn.setDisabled(false).setButtonText(t("settings.testConnection"));
        }
      });
      const parent = btn.buttonEl.parentElement;
      if (parent) {
        resultEl = parent.createEl("span");
        resultEl.setCssStyles({
          marginRight: "12px",
          fontSize: "12px",
          whiteSpace: "nowrap",
        });
        parent.insertBefore(resultEl, btn.buttonEl);
      }
    });
  }

  private static createUpdater(plugin: FileAutoUploadPlugin, key: string) {
    return (value: string) => {
      const config =
        plugin.configurationManager.getSettings().storageServiceConfig;
      void plugin.configurationManager.saveSettings(
        { storageServiceConfig: { ...config, [key]: value } },
        true,
      );
    };
  }

  private static addField(
    containerEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    settings: FileAutoUploadSettings,
    field: FieldConfig,
  ): void {
    const value = (settings.storageServiceConfig[field.key] as string) || field.defaultValue || "";
    const updater = this.createUpdater(plugin, field.key);

    if (field.isPassword) {
      new PasswordSetting(containerEl)
        .setName(t(field.name))
        .setDesc(t(field.desc))
        .addPasswordText((text) => {
          text.setValue(value);
          text.onChange(updater);
          text.inputEl.setCssStyles(this.INPUT_STYLE);
          if (field.placeholder) {
            text.setPlaceholder(field.placeholder);
          }
        });
    } else {
      new Setting(containerEl)
        .setName(t(field.name))
        .setDesc(t(field.desc))
        .addText((text) => {
          text
            .setValue(value)
            .onChange(updater)
            .inputEl.setCssStyles(this.INPUT_STYLE);
          if (field.placeholder) {
            text.setPlaceholder(field.placeholder);
          }
        });
    }
  }
}
