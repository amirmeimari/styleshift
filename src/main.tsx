import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/popup/App";
import "@/index.css";
import { initializeTheme } from "@/shared/theme";

document.documentElement.classList.add("styleshift-popup-page");
document.body.classList.add("styleshift-popup-page");

initializeTheme().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
