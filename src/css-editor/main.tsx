import React from "react";
import ReactDOM from "react-dom/client";
import { CSSEditorApp } from "./App";
import "../index.css";
import { I18nProvider } from "@/shared/i18n/use-i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <CSSEditorApp />
    </I18nProvider>
  </React.StrictMode>,
);
