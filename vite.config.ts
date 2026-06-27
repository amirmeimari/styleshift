import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// This config covers the extension *pages* (popup, css-editor, font-manager)
// and the dev server. The content script and service worker are built as
// self-contained bundles by `scripts/build-extension.mjs` (see `npm run build`),
// because classic content scripts cannot use ES-module code-splitting.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        "css-editor": resolve(__dirname, "css-editor.html"),
        "font-manager": resolve(__dirname, "font-manager.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
