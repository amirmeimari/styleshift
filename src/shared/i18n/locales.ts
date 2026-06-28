// Supported UI languages. `dir` drives the document direction so Arabic and
// Farsi render right-to-left.

export type LocaleCode = "en" | "es" | "ar" | "zh" | "fa";

export type Locale = {
  code: LocaleCode;
  /** Name shown in the language switcher, in the language itself. */
  nativeName: string;
  dir: "ltr" | "rtl";
};

export const LOCALES: Locale[] = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "es", nativeName: "Español", dir: "ltr" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "zh", nativeName: "中文", dir: "ltr" },
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
