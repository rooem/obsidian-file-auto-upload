import { Setting } from "obsidian";

const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

export class PasswordSetting extends Setting {
  addPasswordText(cb: (text: { inputEl: HTMLInputElement; setValue: (v: string) => void; setPlaceholder: (p: string) => void; onChange: (fn: (v: string) => void) => void }) => void): this {
    const inputEl = document.createElement("input");
    inputEl.type = "password";
    inputEl.spellcheck = false;
    inputEl.style.paddingRight = "30px";

    const wrapper = this.controlEl.createDiv({ cls: "password-input-wrapper" });
    wrapper.style.position = "relative";
    wrapper.appendChild(inputEl);

    const btn = wrapper.createEl("span", { cls: "password-toggle-btn" });
    btn.innerHTML = EYE_ICON;
    btn.setCssStyles({ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", opacity: "0.6", display: "flex" });
    btn.onclick = () => {
      const isHidden = inputEl.type === "password";
      inputEl.type = isHidden ? "text" : "password";
      btn.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
    };

    let onChangeFn: ((v: string) => void) | null = null;
    inputEl.addEventListener("input", () => onChangeFn?.(inputEl.value));

    cb({
      inputEl,
      setValue: (v: string) => { inputEl.value = v; },
      setPlaceholder: (p: string) => { inputEl.placeholder = p; },
      onChange: (fn: (v: string) => void) => { onChangeFn = fn; },
    });

    return this;
  }
}
