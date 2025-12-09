import { App, Modal, Plugin, Setting } from "obsidian";
import { t } from "../i18n";

interface ObsidianApp extends App {
  setting?: {
    open(): void;
    openTabById(id: string): void;
  };
}

/**
 * Modal dialog for storage configuration prompt
 * Shown when user attempts upload without configured storage
 */
export class StorageConfigModal extends Modal {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName(t("modal.storageConfig.title")).setHeading();

    const messageDiv = contentEl.createDiv();
    messageDiv.createEl("p", { text: t("modal.storageConfig.message") });

    const buttonDiv = contentEl.createDiv();
    buttonDiv.setCssStyles({ textAlign: "center", marginTop: "20px" });

    const openSettingsBtn = buttonDiv.createEl("button", {
      text: t("modal.storageConfig.openSettings"),
      cls: "mod-cta",
    });
    openSettingsBtn.onclick = () => {
      this.close();
      const app = this.plugin.app as ObsidianApp;
      if (app.setting) {
        app.setting.open();
        app.setting.openTabById(this.plugin.manifest.id);
      }
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
