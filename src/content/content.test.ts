// End-to-end check of the content script's apply loop against a stubbed
// chrome.*. It exists for one invariant in particular: switching a host's
// custom CSS off must leave the font rules alone. The two style elements are
// written by the same applySettings() call, so a regression there is easy to
// introduce and invisible until someone's page loses its font.

import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  CSS_STYLE_ID,
  FONT_STYLE_ID,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
} from "@/shared/style-core";

type Change = { oldValue?: unknown; newValue?: unknown };

const store: Record<string, unknown> = {};
const storageListeners = new Set<
  (changes: Record<string, Change>, area: string) => void
>();

const HOST = "localhost";

function stubChrome() {
  vi.stubGlobal("chrome", {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onMessage: { addListener: () => {} },
    },
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            list.filter((k) => k in store).map((k) => [k, store[k]]),
          );
        },
        set: async (items: Record<string, unknown>) => {
          const changes: Record<string, Change> = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: store[key], newValue: value };
            store[key] = value;
          }
          storageListeners.forEach((listener) => listener(changes, "local"));
        },
      },
      onChanged: {
        addListener: (
          listener: (c: Record<string, Change>, a: string) => void,
        ) => storageListeners.add(listener),
      },
    },
  });
}

const styleText = (id: string) =>
  document.getElementById(id)?.textContent ?? "";

// The content script debounces reapplies through setTimeout.
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

describe("content script apply loop", () => {
  beforeAll(async () => {
    store[GLOBAL_FONT_STACK_KEY] = ["Inter"];
    store[GLOBAL_MONO_FONT_STACK_KEY] = ["JetBrains Mono"];
    store[HOST] = {
      fontFamily: "",
      monoFontFamily: "",
      fontEnabled: true,
      cssEnabled: true,
      customCSS: "body { background: #f0f0f0; }",
    };
    stubChrome();
    // Imported for its side effects: importing runs loadAndApply().
    await import("./content");
    await settle();
  });

  it("applies the font and the custom CSS", () => {
    expect(styleText(FONT_STYLE_ID)).toContain("Inter");
    expect(styleText(FONT_STYLE_ID)).toContain("JetBrains Mono");
    expect(styleText(CSS_STYLE_ID)).toContain("#f0f0f0");
  });

  it("drops only the CSS when cssEnabled is switched off", async () => {
    await chrome.storage.local.set({
      [HOST]: { ...(store[HOST] as object), cssEnabled: false },
    });
    await settle();

    expect(styleText(CSS_STYLE_ID)).toBe("");
    expect(styleText(FONT_STYLE_ID)).toContain("Inter");
    expect(styleText(FONT_STYLE_ID)).toContain("JetBrains Mono");
  });

  it("restores the CSS when it is switched back on, font untouched", async () => {
    const fontBefore = styleText(FONT_STYLE_ID);

    await chrome.storage.local.set({
      [HOST]: { ...(store[HOST] as object), cssEnabled: true },
    });
    await settle();

    expect(styleText(CSS_STYLE_ID)).toContain("#f0f0f0");
    expect(styleText(FONT_STYLE_ID)).toBe(fontBefore);
  });
});
