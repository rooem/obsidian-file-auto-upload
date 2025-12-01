import ar from "./locales/ar";
import cz from "./locales/cz";
import da from "./locales/da";
import de from "./locales/de";
import en from "./locales/en";
import enGB from "./locales/en-gb";
import es from "./locales/es";
import fr from "./locales/fr";
import hi from "./locales/hi";
import id from "./locales/id";
import it from "./locales/it";
import ja from "./locales/ja";
import ko from "./locales/ko";
import nl from "./locales/nl";
import no from "./locales/no";
import pl from "./locales/pl";
import pt from "./locales/pt";
import ptBR from "./locales/pt-br";
import ro from "./locales/ro";
import ru from "./locales/ru";
import tr from "./locales/tr";
import zhCN from "./locales/zh-cn";
import zhTW from "./locales/zh-tw";
import { moment } from "obsidian";

const locales: Record<string, Record<string, string>> = {
  ar,
  cz,
  da,
  de,
  en,
  "en-gb": enGB,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  pt,
  "pt-br": ptBR,
  ro,
  ru,
  tr,
  "zh-cn": zhCN,
  "zh-tw": zhTW,
  zh: zhCN,
};

// Preload and cache current locale
const currentLocale = moment.locale();
const locale = locales[currentLocale];
const fallbackLocale = locales["en"];

// Cache for translated strings to avoid repeated lookups
const translationCache = new Map<string, string>();

export function t(key: string): string {
  // Check cache first
  if (translationCache.has(key)) {
    return translationCache.get(key) || key;
  }

  // Lookup translation
  const translation = locale?.[key] || fallbackLocale?.[key] || key;

  // Cache the result
  translationCache.set(key, translation);

  return translation;
}

// Optional: Clear cache if locale changes (for future use)
export function clearTranslationCache(): void {
  translationCache.clear();
}
