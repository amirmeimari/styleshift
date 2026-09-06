// Theme preference. "system" tracks the OS via `prefers-color-scheme`; the
// other two are an explicit override that wins regardless of the OS setting.

export type ThemePref = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "__styleshift_theme__";
export const DEFAULT_THEME: ThemePref = "light";

export function isThemePref(value: unknown): value is ThemePref {
  return value === "light" || value === "dark" || value === "system";
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false)
  );
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}
