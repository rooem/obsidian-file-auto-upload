import { App, Modal, Plugin, Setting } from "obsidian";
import { BaseModalComponent } from "./BaseUIComponent";
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
export class StorageConfigModal extends BaseModalComponent {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    const modal = new Modal(plugin.app);
    super(plugin.app, null, modal);
    this.plugin = plugin;
  }

  /**
   * Render the modal content
   */
  render() {
    const contentEl = this.getModalContent();
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
      this.closeModal();
      const app = this.plugin.app as ObsidianApp;
      if (app.setting) {
        app.setting.open();
        app.setting.openTabById(this.plugin.manifest.id);
      }
    };
  }

  /**
   * Clean up when modal is closed
   */
  protected onModalClose(): void {
    super.onModalClose();
    const contentEl = this.getModalContent();
    contentEl.empty();
  }
}
