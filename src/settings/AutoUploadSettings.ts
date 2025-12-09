import FileAutoUploadPlugin from "../main";
import { t } from "../i18n";
import { Setting } from "obsidian";

/**
 * Auto upload settings UI component
 * Renders settings for clipboard upload, drag-drop upload, and file type configuration
 */
export class AutoUploadSettings {
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
      .setName(t("settings.skipDuplicateFiles"))
      .setDesc(t("settings.skipDuplicateFiles.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.skipDuplicateFiles)
          .onChange(async (value: boolean) => {
            await plugin.configurationManager.saveSettings({
              skipDuplicateFiles: value,
            });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.deleteAfterUpload"))
      .setDesc(t("settings.deleteAfterUpload.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.deleteAfterUpload)
          .onChange(async (value: boolean) => {
            await plugin.configurationManager.saveSettings({
              deleteAfterUpload: value,
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

        const notEmptyEl = container.createEl("span", { text: "" });
        notEmptyEl.setCssStyles({
          color: "var(--text-muted)",
          marginRight: "12px",
          fontSize: "15px",
          whiteSpace: "nowrap",
        });
        container.insertBefore(notEmptyEl, toggle.inputEl);

        toggle.setValue(settings.autoUploadFileTypes.join(","));
        toggle.onChange(async (value: string) => {
          notEmptyEl?.setText("");
          if (!value || value.trim() === "") {
            notEmptyEl?.setText(t("settings.fileTypes.empty"));
            notEmptyEl?.setCssStyles({ color: "red" });
            return;
          }

          // Convert string to array (support both , and ，)
          const fileTypesArray = value
            .replace(/，/g, ",")
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t);
          await plugin.configurationManager.saveSettings({
            autoUploadFileTypes: fileTypesArray,
          });
        });

        return toggle;
      });
  }
}
