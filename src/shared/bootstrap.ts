// Runs once per entry point (popup, options), before createRoot, so the
// first paint already has the right theme and language - a single batched
// storage read instead of ThemeProvider and I18nProvider each fetching their
// own key.

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemePref,
  resolveTheme,
  type ThemePref,
} from "./theme";
import {
  LOCALE_STORAGE_KEY,
  localeDir,
  resolveUiLocale,
  type LocaleCode,
} from "./i18n/locales";

export type Bootstrap = { theme: ThemePref; locale: LocaleCode };

export async function bootstrapThemeAndLocale(): Promise<Bootstrap> {
  let theme: ThemePref = DEFAULT_THEME;
  let storedLocale: unknown;

  try {
    const stored = await chrome.storage.local.get([
      THEME_STORAGE_KEY,
      LOCALE_STORAGE_KEY,
    ]);
    const storedTheme = stored[THEME_STORAGE_KEY];
    storedLocale = stored[LOCALE_STORAGE_KEY];
    if (isThemePref(storedTheme)) {
      theme = storedTheme;
    }
  } catch {
    // Fall back to the default theme and the browser's language.
  }

  const locale = resolveUiLocale(storedLocale);
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(theme) === "dark",
  );
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDir(locale);

  return { theme, locale };
}
