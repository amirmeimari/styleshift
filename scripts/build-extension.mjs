// StyleShift build.
//
// Extension *pages* (popup, css-editor, font-manager) are loaded as ES modules
// from the extension origin, so normal Vite/Rollup code-splitting is fine and
// lets them share the `style-core`/`storage`/etc. chunks.
//
// The *content script* and the *service worker* cannot use code-splitting:
// classic content scripts are not ES modules and cannot resolve `import`s, so
// they must each be emitted as a single self-contained file. We build them in
// separate passes with `inlineDynamicImports` so the shared source modules are
// inlined into one bundle apiece.

import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const root = process.cwd();
const alias = { "@": resolve(root, "./src") };

// 1. HTML pages — module output, shared chunks allowed. Clears dist first.
await build({
  configFile: false,
  plugins: [react()],
  resolve: { alias },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, "popup.html"),
        "css-editor": resolve(root, "css-editor.html"),
        "font-manager": resolve(root, "font-manager.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});

// 2. Content script + service worker — each a single self-contained file.
for (const name of ["content", "background"]) {
  await build({
    configFile: false,
    resolve: { alias },
    build: {
      outDir: "dist",
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(root, `src/${name}/${name}.ts`),
        output: {
          entryFileNames: "[name].js",
          format: "iife",
          inlineDynamicImports: true,
        },
      },
    },
  });
}
