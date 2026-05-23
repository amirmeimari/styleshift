import React from "react";
import ReactDOM from "react-dom/client";
import { FontManagerApp } from "./App";
import "@/index.css";
import { initializeTheme } from "@/shared/theme";

initializeTheme().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <FontManagerApp />
    </React.StrictMode>,
  );
});
