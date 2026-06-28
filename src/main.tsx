import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/popup/App";
import "@/index.css";
import { initializeTheme } from "@/shared/theme";
import { I18nProvider } from "@/shared/i18n/use-i18n";

document.documentElement.classList.add("styleshift-popup-page");
document.body.classList.add("styleshift-popup-page");

initializeTheme().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>,
  );
});
