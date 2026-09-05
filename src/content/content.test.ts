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
  GLOBAL_CSS_KEY,
  GLOBAL_CSS_STYLE_ID,
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

  it("applies global CSS ahead of the per-host sheet and reacts to changes", async () => {
    await chrome.storage.local.set({
      [GLOBAL_CSS_KEY]: "html { background: black; }",
    });
    await settle();

    expect(styleText(GLOBAL_CSS_STYLE_ID)).toContain("background: black");
    const global = document.getElementById(GLOBAL_CSS_STYLE_ID);
    const perHost = document.getElementById(CSS_STYLE_ID);
    expect(
      global!.compareDocumentPosition(perHost!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("settles: no further reapply once nothing in storage is changing", async () => {
    // applySettings must be a DOM no-op when nothing changed - otherwise the
    // MutationObserver that watches for a removed injected style (to recover
    // from a page stripping it) sees its own relocation of that style as a
    // removal and reschedules forever. A real regression here would not fail
    // the assertions above (they check content after one fixed settle delay)
    // - it only shows up as reapply calls that never stop.
    await settle();
    const getSpy = vi.spyOn(chrome.storage.local, "get");
    const callsBefore = getSpy.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(getSpy.mock.calls.length).toBe(callsBefore);
    getSpy.mockRestore();
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
