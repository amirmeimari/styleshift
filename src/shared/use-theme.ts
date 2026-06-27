import { useCallback, useEffect, useState } from "react";
import {
  initializeTheme,
  setThemePreference,
  type ThemeMode,
} from "@/shared/theme";

// Shared theme state for every extension page. Applies the persisted theme on
// mount and exposes a toggle, replacing the per-page copies of this logic.
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    initializeTheme().then(setTheme);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    await setThemePreference(next);
  }, [theme]);

  return { theme, toggleTheme };
}
