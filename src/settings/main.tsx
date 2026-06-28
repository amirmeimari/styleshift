import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./App";
import "@/index.css";
import { initializeTheme } from "@/shared/theme";
import { I18nProvider } from "@/shared/i18n/use-i18n";

initializeTheme().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <I18nProvider>
        <SettingsApp />
      </I18nProvider>
    </React.StrictMode>,
  );
});
