// Supported UI languages. `dir` drives the document direction so Arabic and
// Farsi render right-to-left.

export type LocaleCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt-BR"
  | "ar"
  | "zh"
  | "zh-TW"
  | "ja"
  | "ko"
  | "fa";

export type Locale = {
  code: LocaleCode;
  /** Name shown in the language switcher, in the language itself. */
  nativeName: string;
  dir: "ltr" | "rtl";
};

export const LOCALES: Locale[] = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "es", nativeName: "Español", dir: "ltr" },
  { code: "fr", nativeName: "Français", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
  { code: "pt-BR", nativeName: "Português (Brasil)", dir: "ltr" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "zh", nativeName: "简体中文", dir: "ltr" },
  { code: "zh-TW", nativeName: "繁體中文（台灣）", dir: "ltr" },
  { code: "ja", nativeName: "日本語", dir: "ltr" },
  { code: "ko", nativeName: "한국어", dir: "ltr" },
  { code: "fa", nativeName: "فارسی", dir: "rtl" },
];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const LOCALE_STORAGE_KEY = "__styleshift_locale__";

export function localeDir(code: LocaleCode): "ltr" | "rtl" {
  return LOCALES.find((locale) => locale.code === code)?.dir ?? "ltr";
}

export function isLocaleCode(value: unknown): value is LocaleCode {
  return (
    typeof value === "string" && LOCALES.some((locale) => locale.code === value)
  );
}

export function resolveUiLocale(storedLocale?: unknown): LocaleCode {
  if (isLocaleCode(storedLocale)) return storedLocale;

  const tag = globalThis.chrome?.i18n
    ?.getUILanguage()
    .toLowerCase()
    .replaceAll("_", "-");
  if (tag === "pt-br") return "pt-BR";

  const [language, variant] = tag?.split("-") ?? [];
  if (language === "zh" && ["hant", "tw", "hk", "mo"].includes(variant)) {
    return "zh-TW";
  }
  return isLocaleCode(language) ? language : DEFAULT_LOCALE;
}
