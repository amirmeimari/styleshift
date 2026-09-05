import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/popup/App";
import "@/index.css";
import { I18nProvider } from "@/shared/i18n/use-i18n";
import { ThemeProvider } from "@/shared/theme-provider";
import { THEME_STORAGE_KEY, isThemePref, resolveTheme } from "@/shared/theme";

// Dev server only: stub the chrome.* APIs so the popup is interactive outside
// an extension host. Stripped from the production bundle.
if (import.meta.env.DEV) {
  const { installChromeMock } = await import("@/dev/chrome-mock");
  installChromeMock();
}

document.documentElement.classList.add("styleshift-popup-page");
document.body.classList.add("styleshift-popup-page");

// Set the class before the first paint so there is no flash of the wrong
// theme when the user has an explicit override that disagrees with the OS.
try {
  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const pref = stored[THEME_STORAGE_KEY];
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(isThemePref(pref) ? pref : "system") === "dark",
  );
} catch {
  // ThemeProvider will resolve and apply it once mounted instead.
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
