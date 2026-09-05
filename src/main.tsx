import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/popup/App";
import "@/index.css";
import { I18nProvider } from "@/shared/i18n/use-i18n";
import { ThemeProvider } from "@/shared/theme-provider";
import { bootstrapThemeAndLocale } from "@/shared/bootstrap";

// Dev server only: stub the chrome.* APIs so the popup is interactive outside
// an extension host. Stripped from the production bundle.
if (import.meta.env.DEV) {
  const { installChromeMock } = await import("@/dev/chrome-mock");
  installChromeMock();
}

document.documentElement.classList.add("styleshift-popup-page");
document.body.classList.add("styleshift-popup-page");

// Resolves + paints the stored theme/language before the first render (no
// flash of the wrong one), in one batched storage read the providers below
// don't need to repeat.
const { theme, locale } = await bootstrapThemeAndLocale();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider initialTheme={theme}>
      <I18nProvider initialLocale={locale}>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
