
import FileAutoUploadPlugin from "../main";
import { t } from "../i18n";
import { Setting } from "obsidian";

/**
 * Auto upload settings UI component
 * Renders settings for clipboard upload, drag-drop upload, and file type configuration
 */
export class AutoUploadSettings {
  /**
   * Render auto upload settings section
   * @param containerEl - Container element to render into
   * @param plugin - Plugin instance
   */
  static render(containerEl: HTMLElement, plugin: FileAutoUploadPlugin): void {
    new Setting(containerEl).setName(t("settings.autoUpload")).setHeading();
    const settings = plugin.configurationManager.getSettings();

    new Setting(containerEl)
      .setName(t("settings.clipboardAutoUpload"))
      .setDesc(t("settings.clipboardAutoUpload.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.clipboardAutoUpload)
          .onChange(async (value: boolean) => {
            await plugin.configurationManager.saveSettings({
              clipboardAutoUpload: value,
            });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.dragAutoUpload"))
      .setDesc(t("settings.dragAutoUpload.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.dragAutoUpload)
          .onChange(async (value: boolean) => {
            await plugin.configurationManager.saveSettings({
              dragAutoUpload: value,
            });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.fileTypes"))
      .setDesc(t("settings.fileTypes.desc"))
      .addTextArea((toggle) => {
        toggle.inputEl.setCssStyles({
          width: "300px",
          height: "100px",
        });

        const container = toggle.inputEl.parentElement;
        if (!container) {
          return;
        }

        let notEmptyEl = container.createEl("span", { text: "" });
        notEmptyEl.setCssStyles({
          color: "var(--text-muted)",
          marginRight: "12px",
          fontSize: "15px",
          whiteSpace: "nowrap",
        });
        container.insertBefore(notEmptyEl, toggle.inputEl);

        let isUpdating = false;
        toggle.setValue(settings.autoUploadFileTypes.join(","));
        toggle.onChange(async (value: string) => {
          notEmptyEl?.setText("");
          if (!value || value.trim() === "") {
            notEmptyEl?.setText(t("settings.fileTypes.empty"));
            notEmptyEl?.setCssStyles({ color: "red" });
            return;
          }

          if (isUpdating) {
            return;
          }

          if (value.includes("，")) {
            isUpdating = true;
            value = value.replace(/，/g, ",");
            setTimeout(() => {
              toggle.inputEl.value = value;
              isUpdating = false;
            }, 0);

            // Convert string to array
            const fileTypesArray = value
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t);
            await plugin.configurationManager.saveSettings({
              autoUploadFileTypes: fileTypesArray,
            });

            return;
          }
        });

        return toggle;
      });
  }
}
