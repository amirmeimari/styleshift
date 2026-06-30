import { afterEach, describe, expect, it, vi } from "vitest";
import {
  availableFontStack,
  ensureStyle,
  fontStyleText,
  formatFontFamily,
  generateCustomFontFace,
  getHostname,
  hostMatchesPreset,
  isInjectableUrl,
  isPreActivatedHost,
  parseFontStack,
  primaryFontFamily,
  serializeFontStack,
  type StyleShiftSettings,
} from "./style-core";

describe("parseFontStack", () => {
  it("splits on commas and trims quotes/whitespace", () => {
    expect(parseFontStack(`"Fira Code", Arial , 'Inter'`)).toEqual([
      "Fira Code",
      "Arial",
      "Inter",
    ]);
  });

  it("drops empty entries", () => {
    expect(parseFontStack("Arial,,  , Inter")).toEqual(["Arial", "Inter"]);
  });

  it("returns [] for an empty string", () => {
    expect(parseFontStack("")).toEqual([]);
  });
});

describe("formatFontFamily", () => {
  it("quotes multi-word family names", () => {
    expect(formatFontFamily("Fira Code")).toBe('"Fira Code"');
  });

  it("leaves single-word names unquoted", () => {
    expect(formatFontFamily("Inter")).toBe("Inter");
  });

  it("preserves generic keywords unquoted", () => {
    expect(formatFontFamily("sans-serif")).toBe("sans-serif");
    expect(formatFontFamily("monospace")).toBe("monospace");
  });

  it("escapes embedded double quotes", () => {
    expect(formatFontFamily('My "Cool" Font')).toBe('"My \\"Cool\\" Font"');
  });

  it("returns empty string for blank input", () => {
    expect(formatFontFamily("   ")).toBe("");
  });
});

describe("serializeFontStack", () => {
  it("formats and joins a stack", () => {
    expect(serializeFontStack(["Fira Code", "Inter", "monospace"])).toBe(
      '"Fira Code", Inter, monospace',
    );
  });

  it("round-trips through parseFontStack", () => {
    const serialized = '"Fira Code", Inter, monospace';
    expect(serializeFontStack(parseFontStack(serialized))).toBe(serialized);
  });
});

describe("primaryFontFamily", () => {
  it("returns the first family without quotes", () => {
    expect(primaryFontFamily(`"Fira Code", Inter`)).toBe("Fira Code");
  });

  it("returns empty string when none", () => {
    expect(primaryFontFamily("")).toBe("");
  });
});

describe("getHostname", () => {
  it("extracts the hostname", () => {
    expect(getHostname("https://www.google.com/search?q=x")).toBe(
      "www.google.com",
    );
  });

  it("returns empty for invalid or missing urls", () => {
    expect(getHostname("not a url")).toBe("");
    expect(getHostname()).toBe("");
  });
});

describe("hostMatchesPreset / isPreActivatedHost", () => {
  it("matches exact and subdomain hosts", () => {
    expect(hostMatchesPreset("google.com", "google.com")).toBe(true);
    expect(hostMatchesPreset("www.google.com", "google.com")).toBe(true);
    expect(hostMatchesPreset("notgoogle.com", "google.com")).toBe(false);
  });

  it("recognizes known presets", () => {
    expect(isPreActivatedHost("github.com")).toBe(true);
    expect(isPreActivatedHost("gist.github.com")).toBe(true);
    expect(isPreActivatedHost("example.org")).toBe(false);
  });
});

describe("isInjectableUrl", () => {
  it("allows http and https only", () => {
    expect(isInjectableUrl("https://example.com")).toBe(true);
    expect(isInjectableUrl("http://example.com")).toBe(true);
    expect(isInjectableUrl("chrome://extensions")).toBe(false);
    expect(isInjectableUrl("file:///etc/hosts")).toBe(false);
    expect(isInjectableUrl(undefined)).toBe(false);
  });
});

describe("generateCustomFontFace", () => {
  it("emits a @font-face with the data url", () => {
    const css = generateCustomFontFace({
      id: "1",
      name: "MyFont",
      data: "AAAA",
      mimeType: "font/woff2",
      format: "woff2",
    });
    expect(css).toContain("font-family: 'MyFont'");
    expect(css).toContain("data:application/woff2;base64,AAAA");
    expect(css).toContain("format('woff2')");
  });
});

describe("ensureStyle", () => {
  afterEach(() => {
    document.getElementById("test-style")?.remove();
  });

  it("does not touch textContent when content is unchanged", () => {
    ensureStyle("test-style", "body { color: red; }");
    const style = document.getElementById("test-style") as HTMLStyleElement;

    // Re-creating @font-face rules resets their FontFace load state, which is
    // exactly what breaks fonts across SPA navigations (loadAndApply() calls
    // ensureStyle on every route change with identical @font-face content).
    // Spying on the textContent setter lets us assert it's skipped entirely.
    const setterSpy = vi.fn();
    Object.defineProperty(style, "textContent", {
      configurable: true,
      get: () => "body { color: red; }",
      set: setterSpy,
    });

    ensureStyle("test-style", "body { color: red; }");
    expect(setterSpy).not.toHaveBeenCalled();
  });

  it("updates textContent when content changes", () => {
    ensureStyle("test-style", "body { color: red; }");
    ensureStyle("test-style", "body { color: blue; }");
    const style = document.getElementById("test-style") as HTMLStyleElement;
    expect(style.textContent).toBe("body { color: blue; }");
  });

  it("removes the element when cssText is blank", () => {
    ensureStyle("test-style", "body { color: red; }");
    ensureStyle("test-style", "");
    expect(document.getElementById("test-style")).toBeNull();
  });
});

describe("font availability (mocked document.fonts)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockAvailable(available: string[]) {
    // jsdom has no FontFaceSet; stub document.fonts.check.
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        check: (spec: string) =>
          available.some((name) => spec.includes(`"${name}"`)),
      },
    });
  }

  it("filters availableFontStack to installed + custom fonts", () => {
    mockAvailable(["Inter"]);
    expect(
      availableFontStack("Inter, Missing, Uploaded", ["Uploaded"]),
    ).toEqual(["Inter", "Uploaded"]);
  });

  it("fontStyleText returns empty when disabled", () => {
    mockAvailable(["Inter"]);
    const settings: StyleShiftSettings = {
      fontFamily: "Inter",
      monoFontFamily: "",
      fontEnabled: false,
      customCSS: "",
    };
    expect(fontStyleText(settings)).toBe("");
  });

  it("fontStyleText builds an !important rule for available fonts", () => {
    mockAvailable(["Inter"]);
    const settings: StyleShiftSettings = {
      fontFamily: "Inter, Missing",
      monoFontFamily: "",
      fontEnabled: true,
      customCSS: "",
    };
    const css = fontStyleText(settings);
    expect(css).toContain("font-family: Inter !important;");
    expect(css).not.toContain("Missing");
  });

  it("fontStyleText adds a mono rule when a mono font is available", () => {
    mockAvailable(["Inter", "Fira Code"]);
    const settings: StyleShiftSettings = {
      fontFamily: "Inter",
      monoFontFamily: "Fira Code",
      fontEnabled: true,
      customCSS: "",
    };
    const css = fontStyleText(settings);
    expect(css).toContain('font-family: "Fira Code" !important;');
  });
});
