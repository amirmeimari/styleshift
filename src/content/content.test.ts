// End-to-end check of the content script's apply loop against a stubbed
// chrome.*. It exists for two invariants in particular: switching a host's
// custom CSS off must leave the font rules alone, and a subdomain page must
// react to a settings change on the ancestor domain it inherits from. Both
// are easy to break and invisible until someone's page loses its font or
// stops picking up a parent domain's CSS.

import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  CSS_STYLE_ID,
  FONT_STYLE_ID,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
} from "@/shared/style-core";
import { stubChrome } from "@/shared/test-chrome";

const store: Record<string, unknown> = {};

const HOST = "localhost";

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
      includeSubdomains: true,
    };
    stubChrome(store);
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

describe("content script reacts to ancestor-domain settings", () => {
  it("reapplies a subdomain page when the parent domain's key changes", async () => {
    const subdomainStore: Record<string, unknown> = {
      [GLOBAL_FONT_STACK_KEY]: [],
      [GLOBAL_MONO_FONT_STACK_KEY]: [],
      "github.com": {
        fontFamily: "",
        monoFontFamily: "",
        fontEnabled: true,
        cssEnabled: true,
        customCSS: "body { background: #abcabc; }",
        includeSubdomains: true,
      },
    };

    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        hostname: "gist.github.com",
        href: "https://gist.github.com/",
      },
      configurable: true,
    });

    stubChrome(subdomainStore);
    vi.resetModules();
    await import("./content");
    await settle();

    expect(styleText(CSS_STYLE_ID)).toContain("#abcabc");

    await chrome.storage.local.set({
      "github.com": {
        ...(subdomainStore["github.com"] as object),
        customCSS: "body { background: #123123; }",
      },
    });
    await settle();

    expect(styleText(CSS_STYLE_ID)).toContain("#123123");
  });
});
