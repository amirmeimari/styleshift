import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySettings,
  availableFontStack,
  CSS_STYLE_ID,
  DEFAULT_TYPOGRAPHY,
  ensureStyle,
  FONT_STYLE_ID,
  GLOBAL_CSS_STYLE_ID,
  fontStyleText,
  formatFontFamily,
  generateCustomFontFace,
  getHostname,
  hostMatchesPreset,
  hostSettingsCandidates,
  isInjectableUrl,
  isPreActivatedHost,
  normalizeTypography,
  parseFontStack,
  primaryFontFamily,
  PROSE_TARGET_SELECTOR,
  PROSE_WEIGHT_TARGET_SELECTOR,
  serializeFontStack,
  TARGET_EXCLUSIONS,
  TEXT_TARGET_SELECTOR,
  TYPOGRAPHY_RANGES,
  type StyleShiftSettings,
  type TypographySettings,
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

describe("hostSettingsCandidates", () => {
  it("walks a single-level subdomain up to the main domain", () => {
    expect(hostSettingsCandidates("www.github.com")).toEqual([
      "www.github.com",
      "github.com",
    ]);
  });

  it("walks a two-level subdomain through each ancestor", () => {
    expect(hostSettingsCandidates("gist.github.com")).toEqual([
      "gist.github.com",
      "github.com",
    ]);
    expect(hostSettingsCandidates("a.b.github.com")).toEqual([
      "a.b.github.com",
      "b.github.com",
      "github.com",
    ]);
    expect(hostSettingsCandidates("x.docs.google.com")).toEqual([
      "x.docs.google.com",
      "docs.google.com",
      "google.com",
    ]);
  });

  it("stops at a two-part TLD's registrable domain", () => {
    expect(hostSettingsCandidates("a.b.c.co.uk")).toEqual([
      "a.b.c.co.uk",
      "b.c.co.uk",
      "c.co.uk",
    ]);
  });

  it("never treats a shared multi-tenant hosting domain as a valid inheritance root", () => {
    // Two unrelated tenants' project pages both sit one label below
    // github.io - the bare domain must not become a shared candidate.
    expect(hostSettingsCandidates("victim-project.github.io")).toEqual([
      "victim-project.github.io",
    ]);
    expect(hostSettingsCandidates("my-app.vercel.app")).toEqual([
      "my-app.vercel.app",
    ]);
    expect(hostSettingsCandidates("a.b.github.io")).toEqual([
      "a.b.github.io",
      "b.github.io",
    ]);
  });

  it("returns just the host for a bare domain", () => {
    expect(hostSettingsCandidates("github.com")).toEqual(["github.com"]);
  });

  it("returns just the host for hosts with no hierarchy", () => {
    expect(hostSettingsCandidates("localhost")).toEqual(["localhost"]);
    expect(hostSettingsCandidates("192.168.1.5")).toEqual(["192.168.1.5"]);
  });

  it("returns [] for an empty hostname", () => {
    expect(hostSettingsCandidates("")).toEqual([]);
  });

  it("normalizes case and a trailing dot", () => {
    expect(hostSettingsCandidates("GIST.GitHub.com")).toEqual([
      "gist.github.com",
      "github.com",
    ]);
    expect(hostSettingsCandidates("github.com.")).toEqual(["github.com"]);
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
      includeSubdomains: true,
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
      includeSubdomains: true,
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
      includeSubdomains: true,
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
    includeSubdomains: true,
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

describe("applySettings global CSS", () => {
  afterEach(() => {
    document.getElementById(CSS_STYLE_ID)?.remove();
    document.getElementById(GLOBAL_CSS_STYLE_ID)?.remove();
  });

  const base: StyleShiftSettings = {
    fontFamily: "",
    monoFontFamily: "",
    fontEnabled: false,
    cssEnabled: true,
    customCSS: "body { color: red; }",
    includeSubdomains: true,
  };

  it("emits nothing when omitted, matching pre-existing behavior exactly", () => {
    applySettings(base);
    expect(document.getElementById(GLOBAL_CSS_STYLE_ID)).toBeNull();
  });

  it("injects global CSS into its own element, independent of cssEnabled", () => {
    applySettings(
      { ...base, cssEnabled: false },
      [],
      DEFAULT_TYPOGRAPHY,
      "html { background: black; }",
    );
    expect(document.getElementById(GLOBAL_CSS_STYLE_ID)?.textContent).toBe(
      "html { background: black; }",
    );
  });

  it("orders the global sheet before the per-host sheet, so per-host rules win ties", () => {
    applySettings(base, [], DEFAULT_TYPOGRAPHY, "html { background: black; }");
    const global = document.getElementById(GLOBAL_CSS_STYLE_ID);
    const perHost = document.getElementById(CSS_STYLE_ID);
    expect(global).not.toBeNull();
    expect(perHost).not.toBeNull();
    expect(
      global!.compareDocumentPosition(perHost!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

// Prose selector redesign (Phase 2 typography): line-height, letter-spacing,
// and font-weight all inherit, so the right selector strategy is an allowlist
// of block-level prose containers rather than a denylist of exclusions - a
// denylist can't work for line-height, since the vertical-centering hack
// (`line-height: 40px` on a nav `<a>` or a tab label) is unenumerable, while
// an allowlist never touches those elements in the first place.
describe("TARGET_EXCLUSIONS extraction", () => {
  it("rebuilds TEXT_TARGET_SELECTOR character-for-character", () => {
    expect(TEXT_TARGET_SELECTOR).toBe(
      [
        ":where(body, body *)",
        ":not(i)",
        ":not(i *)",
        ":not(svg)",
        ":not(svg *)",
        ":not(code)",
        ":not(code *)",
        ":not(pre)",
        ":not(pre *)",
        ":not(kbd)",
        ":not(kbd *)",
        ":not(samp)",
        ":not(samp *)",
        ":not(tt)",
        ":not(tt *)",
        ":not([class*='icon' i])",
        ":not([class*='icon' i] *)",
        ":not([class*='material-icons' i])",
        ":not([class*='material-icons' i] *)",
        ":not([class*='google-symbols' i])",
        ":not([class*='google-symbols' i] *)",
        ":not([style*='Google Symbols' i])",
        ":not([class^='fa-'])",
        ":not([class*=' fa-'])",
        ":not([role='img'])",
        ":not([role='img'] *)",
        ":not([aria-hidden='true'])",
        ":not([aria-hidden='true'] *)",
      ].join(""),
    );
  });

  it("PROSE_TARGET_SELECTOR carries the same exclusion tail on every element", () => {
    for (const selector of PROSE_TARGET_SELECTOR.split(", ")) {
      expect(selector.endsWith(TARGET_EXCLUSIONS)).toBe(true);
    }
    expect(PROSE_TARGET_SELECTOR).toContain(`body${TARGET_EXCLUSIONS}`);
    expect(PROSE_TARGET_SELECTOR).toContain(`h1${TARGET_EXCLUSIONS}`);
  });

  it("PROSE_WEIGHT_TARGET_SELECTOR excludes every heading level", () => {
    for (let level = 1; level <= 6; level += 1) {
      expect(PROSE_WEIGHT_TARGET_SELECTOR).not.toContain(
        `h${level}${TARGET_EXCLUSIONS}`,
      );
    }
    expect(PROSE_WEIGHT_TARGET_SELECTOR).toContain(`body${TARGET_EXCLUSIONS}`);
    expect(PROSE_WEIGHT_TARGET_SELECTOR).toContain(`p${TARGET_EXCLUSIONS}`);
  });

  it("PROSE_WEIGHT_TARGET_SELECTOR excludes th like it excludes headings", () => {
    // th is bold by default in every browser's UA stylesheet, same as
    // h1-h6 - flattening it would erase the header/data distinction in
    // every table on the page.
    expect(PROSE_WEIGHT_TARGET_SELECTOR).not.toContain(
      `th${TARGET_EXCLUSIONS}`,
    );
    expect(PROSE_WEIGHT_TARGET_SELECTOR).toContain(`td${TARGET_EXCLUSIONS}`);
  });
});

describe("normalizeTypography", () => {
  it("passes through in-range numbers unchanged", () => {
    expect(
      normalizeTypography({
        lineHeight: 1.6,
        letterSpacing: 0.01,
        fontWeight: 500,
        minFontSize: 14,
      }),
    ).toEqual({
      lineHeight: 1.6,
      letterSpacing: 0.01,
      fontWeight: 500,
      minFontSize: 14,
    });
  });

  it("treats 0 as a valid, in-range letterSpacing value, not unset", () => {
    expect(normalizeTypography({ letterSpacing: 0 }).letterSpacing).toBe(0);
  });

  it("clamps out-of-range numbers to the nearest bound", () => {
    expect(
      normalizeTypography({
        lineHeight: 10,
        letterSpacing: -5,
        fontWeight: 50,
        minFontSize: 999,
      }),
    ).toEqual({
      lineHeight: TYPOGRAPHY_RANGES.lineHeight.max,
      letterSpacing: TYPOGRAPHY_RANGES.letterSpacing.min,
      fontWeight: TYPOGRAPHY_RANGES.fontWeight.min,
      minFontSize: TYPOGRAPHY_RANGES.minFontSize.max,
    });
  });

  it("rounds to avoid floating-point noise in emitted CSS", () => {
    expect(
      normalizeTypography({ letterSpacing: 0.1 + 0.2 }).letterSpacing,
    ).toBe(0.3);
  });

  it("degrades non-numeric input to null rather than coercing it", () => {
    expect(
      normalizeTypography({
        lineHeight: "1.6",
        letterSpacing: null,
        fontWeight: Number.NaN,
        minFontSize: undefined,
      }),
    ).toEqual(DEFAULT_TYPOGRAPHY);
  });

  it("returns all-null defaults for garbage or empty input", () => {
    expect(normalizeTypography(undefined)).toEqual(DEFAULT_TYPOGRAPHY);
    expect(normalizeTypography(null)).toEqual(DEFAULT_TYPOGRAPHY);
    expect(normalizeTypography("not an object")).toEqual(DEFAULT_TYPOGRAPHY);
    expect(normalizeTypography({})).toEqual(DEFAULT_TYPOGRAPHY);
  });

  it("cannot be used to inject stray CSS via a crafted string value", () => {
    const result = normalizeTypography({
      lineHeight: "1; } body { display:none } .x {",
    });
    expect(result.lineHeight).toBeNull();
  });
});

describe("fontStyleText typography rules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // jsdom has no FontFaceSet; stub document.fonts.check (same shape as the
  // helper in the "font availability" describe above, out of scope here).
  function mockAvailable(available: string[]) {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        check: (spec: string) =>
          available.some((name) => spec.includes(`"${name}"`)),
      },
    });
  }

  const enabledSettings: StyleShiftSettings = {
    fontFamily: "",
    monoFontFamily: "",
    fontEnabled: true,
    cssEnabled: true,
    customCSS: "",
    includeSubdomains: true,
  };

  it("is byte-identical to the pre-typography output for all four family/mono shapes", () => {
    mockAvailable(["Inter", "Fira Code"]);

    const disabled: StyleShiftSettings = {
      ...enabledSettings,
      fontFamily: "Inter",
      monoFontFamily: "Fira Code",
      fontEnabled: false,
    };
    expect(fontStyleText(disabled)).toBe("");

    const familyOnly: StyleShiftSettings = {
      ...enabledSettings,
      fontFamily: "Inter",
      monoFontFamily: "",
    };
    expect(fontStyleText(familyOnly)).toBe(
      `${TEXT_TARGET_SELECTOR}, input, textarea, select, button, [contenteditable='true'], [contenteditable='true'] *, [role='textbox'], [role='textbox'] * { font-family: Inter !important; }`,
    );

    const monoOnly: StyleShiftSettings = {
      ...enabledSettings,
      fontFamily: "",
      monoFontFamily: "Fira Code",
    };
    expect(fontStyleText(monoOnly)).toBe(
      `code, code *, pre, pre *, kbd, kbd *, samp, samp *, tt, tt *, [class*='code' i], [class*='code' i] *, [class*='monospace' i], [class*='monospace' i] *, [class*='highlight' i], [class*='highlight' i] * { font-family: "Fira Code" !important; }`,
    );

    const both: StyleShiftSettings = {
      ...enabledSettings,
      fontFamily: "Inter",
      monoFontFamily: "Fira Code",
    };
    expect(fontStyleText(both)).toBe(
      `${fontStyleText(familyOnly)}\n${fontStyleText(monoOnly)}`,
    );

    // Passing DEFAULT_TYPOGRAPHY explicitly must be a no-op - this is the
    // upgrade-safety proof for the Phase 2 restructure.
    expect(fontStyleText(both, [], DEFAULT_TYPOGRAPHY)).toBe(
      fontStyleText(both),
    );
  });

  it("emits line-height/letter-spacing on the prose selector when family has no match", () => {
    mockAvailable([]);
    const typography: TypographySettings = {
      lineHeight: 1.6,
      letterSpacing: 0.01,
      fontWeight: null,
      minFontSize: null,
    };
    const css = fontStyleText(enabledSettings, [], typography);
    expect(css).toBe(
      `${PROSE_TARGET_SELECTOR} { line-height: 1.6 !important; letter-spacing: 0.01em !important; }`,
    );
    expect(css).not.toContain("font-family");
  });

  it("emits font-weight on a selector that never contains a heading, strong, b, or em", () => {
    const typography: TypographySettings = {
      lineHeight: null,
      letterSpacing: null,
      fontWeight: 300,
      minFontSize: null,
    };
    const css = fontStyleText(enabledSettings, [], typography);
    expect(css).toBe(
      `${PROSE_WEIGHT_TARGET_SELECTOR} { font-weight: 300 !important; }`,
    );
    for (const tag of [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
    ]) {
      expect(css).not.toContain(`${tag}${TARGET_EXCLUSIONS}`);
      expect(css).not.toMatch(new RegExp(`(^|[,\\s])${tag}[,{]`));
    }
  });

  it("emits nothing for typography when every field is null", () => {
    expect(fontStyleText(enabledSettings, [], DEFAULT_TYPOGRAPHY)).toBe("");
  });

  it("never emits minFontSize as CSS", () => {
    const typography: TypographySettings = {
      lineHeight: null,
      letterSpacing: null,
      fontWeight: null,
      minFontSize: 20,
    };
    expect(fontStyleText(enabledSettings, [], typography)).toBe("");
  });

  it("gates typography rules on fontEnabled, same as the family rules", () => {
    const typography: TypographySettings = {
      lineHeight: 1.6,
      letterSpacing: null,
      fontWeight: null,
      minFontSize: null,
    };
    expect(
      fontStyleText({ ...enabledSettings, fontEnabled: false }, [], typography),
    ).toBe("");
  });
});
