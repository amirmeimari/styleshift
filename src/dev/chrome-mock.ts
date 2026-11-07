// Development-only stub of the handful of chrome.* APIs the popup touches.
//
// Loaded from main.tsx behind `import.meta.env.DEV`, so it is tree-shaken out of
// the production bundle and never ships. Without it `npm run dev` renders the
// popup with every control disabled - `getActiveTab()` throws because there is
// no chrome.tabs outside an extension host - which makes the dev server useless
// for working on the UI.

import {
  AUTO_ENABLE_ALL_SITES_KEY,
  GLOBAL_CSS_KEY,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
  TYPOGRAPHY_KEY,
  type StyleShiftSettings,
} from "@/shared/style-core";
import { isLocaleCode, LOCALE_STORAGE_KEY } from "@/shared/i18n/locales";
import { isThemePref, THEME_STORAGE_KEY } from "@/shared/theme";

type StorageListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string,
) => void;

const DEMO_SITES: Record<string, StyleShiftSettings> = {
  "github.com": {
    fontFamily: "",
    monoFontFamily: "'JetBrains Mono'",
    fontEnabled: true,
    cssEnabled: true,
    customCSS: "article { max-width: 72ch; }",
    includeSubdomains: true,
  },
  "notion.so": {
    fontFamily: "",
    monoFontFamily: "'JetBrains Mono'",
    fontEnabled: true,
    cssEnabled: false,
    customCSS: "",
    includeSubdomains: false,
  },
};

function demoSeed(params: URLSearchParams): Record<string, unknown> {
  if (params.get("demo") !== "1") return {};

  const state = params.get("state");
  const locale = params.get("locale");
  const theme = params.get("theme");
  const seed: Record<string, unknown> = {};

  if (state !== "empty") {
    seed[GLOBAL_FONT_STACK_KEY] =
      state === "unavailable"
        ? [
            "Inter",
            "A Very Long Unavailable Font Family Name For Visual Verification",
          ]
        : ["Inter", "Vazirmatn"];
    seed[GLOBAL_MONO_FONT_STACK_KEY] = ["JetBrains Mono"];
    seed[GLOBAL_CSS_KEY] =
      "article { max-width: 72ch; margin-inline: auto; }\na { text-underline-offset: 0.18em; }";
    seed[TYPOGRAPHY_KEY] = {
      lineHeight: 1.6,
      letterSpacing: null,
      fontWeight: 400,
      minFontSize: null,
    };
    seed[AUTO_ENABLE_ALL_SITES_KEY] = false;
    Object.assign(seed, DEMO_SITES);
  }

  seed[GLOBAL_ENABLED_KEY] = state !== "disabled";
  if (isLocaleCode(locale)) seed[LOCALE_STORAGE_KEY] = locale;
  if (isThemePref(theme)) seed[THEME_STORAGE_KEY] = theme;
  return seed;
}

export function installChromeMock(): void {
  if (typeof globalThis.chrome !== "undefined" && globalThis.chrome?.tabs) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const store = new Map<string, unknown>(Object.entries(demoSeed(params)));
  const listeners = new Set<StorageListener>();
  const mockTab = {
    id: 1,
    url:
      params.get("state") === "restricted"
        ? "chrome://settings/"
        : "https://github.com/mimalef70/fontara",
    active: true,
    windowId: 1,
  };

  const readKeys = (keys: string | string[] | null | undefined) => {
    if (keys === null || keys === undefined) {
      return Object.fromEntries(store);
    }
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      list
        .filter((key) => store.has(key))
        .map((key) => [key, store.get(key)] as const),
    );
  };

  const local = {
    async get(keys?: string | string[] | null) {
      return readKeys(keys);
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store.get(key), newValue: value };
        store.set(key, value);
      }
      listeners.forEach((listener) => listener(changes, "local"));
    },
    async remove(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const key of list) {
        if (store.has(key)) {
          changes[key] = { oldValue: store.get(key), newValue: undefined };
          store.delete(key);
        }
      }
      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, "local"));
      }
    },
  };

  const chromeMock = {
    storage: {
      local,
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
        removeListener: (listener: StorageListener) =>
          listeners.delete(listener),
      },
    },
    tabs: {
      async query() {
        return [mockTab];
      },
      async create() {
        return undefined;
      },
      async sendMessage() {
        return undefined;
      },
    },
    scripting: {
      async executeScript() {
        return [];
      },
    },
    runtime: {
      getURL: (path: string) => `/${path.replace(/^\//, "")}`,
      getManifest: () => ({ version: "1.2.0" }),
      onMessage: { addListener: () => {}, removeListener: () => {} },
      onInstalled: { addListener: () => {} },
    },
    fontSettings: {
      async setMinimumFontSize() {},
      async clearMinimumFontSize() {},
    },
  };

  Object.defineProperty(globalThis, "chrome", {
    value: chromeMock,
    configurable: true,
    writable: true,
  });

  console.info(
    `[StyleShift] dev chrome mock installed${params.get("demo") === "1" ? " with deterministic demo data" : ""} - storage is in-memory and resets on reload.`,
  );
}
