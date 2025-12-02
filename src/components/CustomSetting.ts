import { Setting } from "obsidian";

/**
 * Custom setting component that extends Obsidian's Setting class
 * Adds support for required field indicators
 */
export class CustomSetting extends Setting {
  /**
   * Mark setting as required with a red asterisk
   * @param value - Whether the field is required
   * @returns this for chaining
   */
  public required(value: boolean = true): this {
    let star = this.nameEl.querySelector("span");
    if (value && !star) {
      star = this.nameEl.createSpan({ text: "*" });
      star.setCssStyles({
                  color: "red",
                  marginRight: "4px",
                });
      this.nameEl.prepend(star);
    } else if (star) {
      star.remove();
    }
    return this;
  }
}
