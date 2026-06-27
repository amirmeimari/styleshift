export type ThemeMode = "light" | "dark";

export const THEME_PREFERENCE_KEY = "__styleshift_theme__";

function readLocalTheme(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "dark";
}

export async function getThemePreference(): Promise<ThemeMode> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const stored = (await chrome.storage.local.get(
        THEME_PREFERENCE_KEY,
      )) as Record<string, ThemeMode | undefined>;
      const theme = stored[THEME_PREFERENCE_KEY];

      if (theme === "light" || theme === "dark") {
        return theme;
      }
    }
  } catch {
    return readLocalTheme();
  }

  return readLocalTheme();
}

export async function setThemePreference(theme: ThemeMode) {
  window.localStorage.setItem(THEME_PREFERENCE_KEY, theme);

  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [THEME_PREFERENCE_KEY]: theme });
    }
  } catch {
    // localStorage fallback above is enough outside extension pages.
  }

  applyTheme(theme);
}

export function applyTheme(theme: ThemeMode) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

export async function toggleTheme(): Promise<ThemeMode> {
  const current = await getThemePreference();
  const next = current === "dark" ? "light" : "dark";
  await setThemePreference(next);
  return next;
}

export async function initializeTheme() {
  const theme = await getThemePreference();
  applyTheme(theme);
  return theme;
}
