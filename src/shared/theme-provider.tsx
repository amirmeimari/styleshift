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
  type ThemePref,
} from "./theme";
import { useStorageKeyListener } from "./use-storage-key-listener";

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

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  // Pass this when the caller already resolved (and painted) the stored pref
  // before mount - e.g. main.tsx's flash-prevention step - so this provider
  // doesn't repeat the same chrome.storage.local read.
  initialTheme?: ThemePref;
}) {
  const [theme, setThemeState] = useState<ThemePref>(
    initialTheme ?? DEFAULT_THEME,
  );
  // Real state, not a value derived from `theme` on every read - it must be
  // independently updatable so an OS-level theme flip (which doesn't change
  // `theme` at all while pref is "system") still propagates to consumers
  // like the CodeMirror editor's theme compartment.
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(initialTheme ?? DEFAULT_THEME),
  );

  const applyTheme = useCallback((pref: ThemePref) => {
    const resolved = resolveTheme(pref);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    setResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    const iconVariant = resolvedTheme === "dark" ? "light" : "dark";
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = `/icons/${iconVariant}/icon32.png`;
    }
    // Extension pages can observe the OS theme; the MV3 worker cannot.
    // Refresh the toolbar when a page opens, preferences change, or System
    // mode changes while a page is open. No extra permissions are needed.
    if (typeof chrome !== "undefined" && chrome.action?.setIcon) {
      void chrome.action
        .setIcon({
          path: {
            16: `icons/${iconVariant}/icon16.png`,
            24: `icons/${iconVariant}/icon24.png`,
            32: `icons/${iconVariant}/icon32.png`,
            48: `icons/${iconVariant}/icon48.png`,
            64: `icons/${iconVariant}/icon64.png`,
            128: `icons/${iconVariant}/icon128.png`,
          },
        })
        .catch(() => {
          // Keep the manifest fallback if the extension context was closed.
        });
    }
  }, [resolvedTheme]);

  useEffect(() => {
    let mounted = true;

    const initial = initialTheme
      ? Promise.resolve(initialTheme)
      : readStoredTheme();

    initial.then((stored) => {
      if (!mounted) {
        return;
      }
      setThemeState(stored);
      applyTheme(stored);
    });

    return () => {
      mounted = false;
    };
    // Only ever consult the caller's pre-resolved value on the initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep every open page in sync when the theme changes elsewhere.
  useStorageKeyListener(
    THEME_STORAGE_KEY,
    useCallback(
      (next) => {
        if (isThemePref(next)) {
          setThemeState(next);
          applyTheme(next);
        } else if (next === undefined) {
          setThemeState(DEFAULT_THEME);
          applyTheme(DEFAULT_THEME);
        }
      },
      [applyTheme],
    ),
  );

  // While following the OS, react to it changing without a storage write.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => applyTheme("system");
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [theme, applyTheme]);

  const setTheme = useCallback(
    async (next: ThemePref) => {
      setThemeState(next);
      applyTheme(next);
      try {
        await chrome.storage.local.set({ [THEME_STORAGE_KEY]: next });
      } catch {
        // in-memory state is already updated
      }
    },
    [applyTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
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
