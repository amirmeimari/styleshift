import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySettings,
  availableFontStack,
  CSS_STYLE_ID,
  ensureStyle,
  FONT_STYLE_ID,
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
    expect(css).toContain("data:font/woff2;base64,AAAA");
    expect(css).toContain("format('woff2')");
  });

  it("maps file extensions to valid CSS format hints", () => {
    // `format('ttf')`/`format('otf')` are not valid CSS - a browser drops the
    // whole rule, so uploaded TrueType/OpenType fonts never applied.
    const ttf = generateCustomFontFace({
      id: "1",
      name: "MyFont",
      data: "AAAA",
      mimeType: "",
      format: "ttf",
    });
    expect(ttf).toContain("format('truetype')");
    expect(ttf).toContain("data:font/ttf;base64,AAAA");

    const otf = generateCustomFontFace({
      id: "2",
      name: "MyFont",
      data: "AAAA",
      mimeType: "",
      format: "OTF",
    });
    expect(otf).toContain("format('opentype')");
    expect(otf).toContain("data:font/otf;base64,AAAA");

    const woff = generateCustomFontFace({
      id: "3",
      name: "MyFont",
      data: "AAAA",
      mimeType: "",
      format: "woff",
    });
    expect(woff).toContain("format('woff')");
  });

  it("falls back to woff2 for an unrecognised format", () => {
    const css = generateCustomFontFace({
      id: "1",
      name: "MyFont",
      data: "AAAA",
      mimeType: "",
      format: "bogus",
    });
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
      cssEnabled: true,
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
      cssEnabled: true,
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
      cssEnabled: true,
      customCSS: "",
    };
    const css = fontStyleText(settings);
    expect(css).toContain('font-family: "Fira Code" !important;');
  });
});

describe("applySettings CSS gating", () => {
  afterEach(() => {
    document.getElementById(CSS_STYLE_ID)?.remove();
  });

  const base: StyleShiftSettings = {
    fontFamily: "",
    monoFontFamily: "",
    fontEnabled: false,
    cssEnabled: true,
    customCSS: "body { color: red; }",
  };

  const injectedCss = () =>
    document.getElementById(CSS_STYLE_ID)?.textContent ?? null;

  it("injects custom CSS when enabled for the host", () => {
    applySettings(base);
    expect(injectedCss()).toBe("body { color: red; }");
  });

  it("withholds custom CSS when the host toggle is off", () => {
    applySettings({ ...base, cssEnabled: false });
    expect(injectedCss()).toBeNull();
  });

  it("keeps applying CSS for settings saved before the toggle existed", () => {
    // Pre-toggle records have no `cssEnabled` key at all; treating that as
    // "off" would silently disable stylesheets people already rely on.
    const legacy = { ...base } as Partial<StyleShiftSettings>;
    delete legacy.cssEnabled;

    applySettings(legacy as StyleShiftSettings);
    expect(injectedCss()).toBe("body { color: red; }");
  });

  it("removes previously injected CSS when the toggle is turned off", () => {
    applySettings(base);
    expect(injectedCss()).toBe("body { color: red; }");

    applySettings({ ...base, cssEnabled: false });
    expect(injectedCss()).toBeNull();
  });
});

describe("ensureStyle head relocation", () => {
  afterEach(() => {
    document.getElementById(CSS_STYLE_ID)?.remove();
    document.getElementById(FONT_STYLE_ID)?.remove();
  });

  it("falls back to documentElement when head is missing", () => {
    const head = document.head;
    head.remove();

    ensureStyle(CSS_STYLE_ID, "body { color: red; }", true);
    const style = document.getElementById(CSS_STYLE_ID);
    expect(style?.parentNode).toBe(document.documentElement);

    document.documentElement.prepend(head);
  });

  it("moves a rule sheet into head once head exists", () => {
    // Mirrors document_start: the sheet is created before <head> is parsed,
    // so it would otherwise sit ahead of the page's own stylesheets and lose
    // every specificity tie.
    const head = document.head;
    head.remove();
    ensureStyle(CSS_STYLE_ID, "body { color: red; }", true);
    document.documentElement.prepend(head);

    ensureStyle(CSS_STYLE_ID, "body { color: red; }", true);
    expect(document.getElementById(CSS_STYLE_ID)?.parentNode).toBe(
      document.head,
    );
  });

  it("leaves font sheets where they were injected", () => {
    // Relocating re-inserts the sheet, which restarts any @font-face load it
    // declares; font rules are !important so position does not matter.
    const head = document.head;
    head.remove();
    ensureStyle(FONT_STYLE_ID, "body { font-family: X !important; }");
    document.documentElement.prepend(head);

    ensureStyle(FONT_STYLE_ID, "body { font-family: X !important; }");
    expect(document.getElementById(FONT_STYLE_ID)?.parentNode).toBe(
      document.documentElement,
    );
  });

  it("keeps the sheet in head across later updates", () => {
    ensureStyle(CSS_STYLE_ID, "body { color: red; }", true);
    ensureStyle(CSS_STYLE_ID, "body { color: blue; }", true);

    const style = document.getElementById(CSS_STYLE_ID);
    expect(style?.parentNode).toBe(document.head);
    expect(style?.textContent).toBe("body { color: blue; }");
  });
});
