import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemePref,
  resolveTheme,
  systemPrefersDark,
  type ThemePref,
} from "./theme";

type ThemeContextValue = {
  theme: ThemePref;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePref) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredTheme(): Promise<ThemePref> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
      const value = stored[THEME_STORAGE_KEY];
      if (isThemePref(value)) {
        return value;
      }
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_THEME;
}

function applyDocumentTheme(pref: ThemePref) {
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(pref) === "dark",
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(DEFAULT_THEME);

  useEffect(() => {
    let mounted = true;

    readStoredTheme().then((stored) => {
      if (!mounted) {
        return;
      }
      setThemeState(stored);
      applyDocumentTheme(stored);
    });

    // Keep every open page in sync when the theme changes elsewhere.
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[THEME_STORAGE_KEY]) {
        return;
      }
      const next = changes[THEME_STORAGE_KEY].newValue;
      if (isThemePref(next)) {
        setThemeState(next);
        applyDocumentTheme(next);
      }
    };

    chrome.storage?.onChanged?.addListener(onChanged);
    return () => {
      mounted = false;
      chrome.storage?.onChanged?.removeListener(onChanged);
    };
  }, []);

  // While following the OS, react to it changing without a storage write.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => applyDocumentTheme("system");
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [theme]);

  const setTheme = useCallback(async (next: ThemePref) => {
    setThemeState(next);
    applyDocumentTheme(next);
    try {
      await chrome.storage.local.set({ [THEME_STORAGE_KEY]: next });
    } catch {
      // in-memory state is already updated
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme:
        theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme,
      setTheme,
    }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
