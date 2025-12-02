import { Notice, Setting } from "obsidian";
import FileAutoUploadPlugin from "../main";
import { t } from "../i18n";

/**
 * Developer settings UI component
 * Renders developer mode configuration (temporary, resets on restart)
 */
export class DeveloperSettings {
  private static developerMode: boolean = false;
  private static debugLogging: boolean = false;

  /**
   * Setup triple-click listener on title element
   * @param titleEl - Title element to attach listener to
   * @param onToggle - Callback when developer mode is toggled
   */
  static setupTripleClickListener(
    titleEl: HTMLElement,
    onToggle: () => void,
  ): void {
    let clickCount = 0;
    let clickTimer: NodeJS.Timeout;

    titleEl.addEventListener("click", () => {
      clickCount++;
      clearTimeout(clickTimer);

      if (clickCount === 3) {
        this.developerMode = !this.developerMode;
        new Notice(
          this.developerMode
            ? t("settings.developer.enabled")
            : t("settings.developer.disabled"),
        );
        onToggle();
        clickCount = 0;
      } else {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 500);
      }
    });
  }

  /**
   * Get current developer mode status
   */
  static isEnabled(): boolean {
    return this.developerMode;
  }

  /**
   * Get debug logging status
   */
  static isDebugLoggingEnabled(): boolean {
    return this.debugLogging;
  }

  /**
   * Render developer settings section
   * @param containerEl - Container element to render into
   * @param plugin - Plugin instance
   * @param onToggle - Callback when developer mode is toggled
   */
  static render(
    containerEl: HTMLElement,
    titleEl: HTMLElement,
    plugin: FileAutoUploadPlugin,
    onToggle: () => void,
  ): void {

    this.setupTripleClickListener(titleEl, onToggle);


    if (this.developerMode) {
      new Setting(containerEl)
        .setName(t("settings.developer"))
        .setHeading();

      new Setting(containerEl)
        .setName(t("settings.developer.name"))
        .setDesc(t("settings.developer.desc"))
        .addToggle((toggle) =>
          toggle.setValue(this.developerMode).onChange((value: boolean) => {
            this.developerMode = value;
            onToggle();
          }),
        );

      new Setting(containerEl)
        .setName(t("settings.developer.debugLogging.name"))
        .setDesc(t("settings.developer.debugLogging.desc"))
        .addToggle((toggle) =>
          toggle.setValue(this.debugLogging).onChange((value: boolean) => {
            this.debugLogging = value;
          }),
        );
    }


  }
}
