import { CustomSetting } from "./CustomSetting";
import FileAutoUploadPlugin from "../main";
import { t } from "../i18n";

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
    containerEl.createEl("h6", { text: t("settings.autoUpload") });
    const settings = plugin.configurationManager.getSettings();

    new CustomSetting(containerEl)
      .setName(t("settings.clipboardAutoUpload"))
      .setDesc(t("settings.clipboardAutoUpload.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.clipboardAutoUpload)
          .onChange(async (value: boolean) => {
            await plugin.configurationManager.updateSettings({
              clipboardAutoUpload: value,
            });
          }),
      );

    new CustomSetting(containerEl)
      .setName(t("settings.dragAutoUpload"))
      .setDesc(t("settings.dragAutoUpload.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.dragAutoUpload)
          .onChange(async (value: boolean) => {
            await plugin.configurationManager.updateSettings({
              dragAutoUpload: value,
            });
          }),
      );

    new CustomSetting(containerEl)
      .setName(t("settings.fileTypes"))
      .setDesc(t("settings.fileTypes.desc"))
      .required()
      .addTextArea((toggle) => {
        let isUpdating = false;
        let notEmptyEl: HTMLElement | null = null;

        // Convert array to string for display
        toggle
          .setValue(settings.autoUploadFileTypes.join(","))
          .onChange(async (value: string) => {
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
              await plugin.configurationManager.updateSettings({
                autoUploadFileTypes: fileTypesArray,
              });

              return;
            }

            if (!value || value.trim() === "") {
              notEmptyEl?.setText(t("settings.fileTypes.empty"));
              if (notEmptyEl) {
                notEmptyEl.style.color = "red";
              }
            } else {
              notEmptyEl?.setText("");
            }

            // Convert string to array
            const fileTypesArray = value
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t);
            await plugin.configurationManager.updateSettings({
              autoUploadFileTypes: fileTypesArray,
            });
          });

        toggle.inputEl.style.width = "300px";
        toggle.inputEl.style.height = "100px";

        const container = toggle.inputEl.parentElement;
        if (container) {
          notEmptyEl = container.createEl("span", { text: "" });

          notEmptyEl.style.marginRight = "12px";
          notEmptyEl.style.fontSize = "15px";
          notEmptyEl.style.whiteSpace = "nowrap";
          notEmptyEl.style.color = "var(--text-muted)";

          container.insertBefore(notEmptyEl, toggle.inputEl);
        }

        return toggle;
      });
  }
}
