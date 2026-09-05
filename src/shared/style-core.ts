// Pure, chrome-free styling logic shared by the content script, the popup, and
// the page-injection path. Keep this module free of any `chrome.*` access so it
// can run in the page context and be unit-tested without an extension host.

import { DEFAULT_MONO_FONT } from "./builtin-fonts";

export type StyleShiftSettings = {
  fontFamily: string;
  monoFontFamily: string;
  fontEnabled: boolean;
  /**
   * Whether the saved custom CSS is applied to this host. Absent in settings
   * written before this existed, which read as `true` so upgrading does not
   * silently switch off stylesheets people already rely on.
   */
  cssEnabled: boolean;
  customCSS: string;
};

export type StyleShiftStorage = Record<string, StyleShiftSettings>;

export type CustomFont = {
  id: string;
  name: string;
  data: string; // base64 encoded
  mimeType: string;
  format: string; // woff2, woff, ttf, etc.
};

export const GLOBAL_ENABLED_KEY = "__styleshift_enabled__";
export const GLOBAL_FONT_STACK_KEY = "__styleshift_font_stack__";
export const GLOBAL_MONO_FONT_STACK_KEY = "__styleshift_mono_font_stack__";
export const AUTO_ENABLE_ALL_SITES_KEY = "__styleshift_auto_enable_all_sites__";
export const CUSTOM_FONTS_KEY = "__styleshift_custom_fonts__";
export const CUSTOM_FONT_INDEX_KEY = "__styleshift_custom_font_index__";
export const CUSTOM_FONT_CHUNK_PREFIX = "__styleshift_custom_font_chunk__";
export const CUSTOM_FONT_CHUNK_SIZE = 7000;

export type SitePreset = {
  host: string;
  label: string;
  icon: string;
  svgIcon: string;
};

export const POPULAR_SITE_PRESETS: SitePreset[] = [
  { host: "google.com", label: "Google", icon: "G", svgIcon: "google" },
  {
    host: "mail.google.com",
    label: "Gmail",
    icon: "GM",
    svgIcon: "gmail-2026",
  },
  {
    host: "maps.google.com",
    label: "Maps",
    icon: "MP",
    svgIcon: "google-maps",
  },
  {
    host: "docs.google.com",
    label: "Google Docs",
    icon: "GD",
    svgIcon: "google-docs-2026",
  },
  { host: "github.com", label: "GitHub", icon: "GH", svgIcon: "github" },
  {
    host: "stackoverflow.com",
    label: "Stack Overflow",
    icon: "SO",
    svgIcon: "stack-overflow",
  },
  { host: "figma.com", label: "Figma", icon: "F", svgIcon: "figma" },
  { host: "npmjs.com", label: "npm", icon: "NP", svgIcon: "npm" },
  { host: "linkedin.com", label: "LinkedIn", icon: "IN", svgIcon: "linkedin" },
  { host: "x.com", label: "X", icon: "X", svgIcon: "x" },
  { host: "facebook.com", label: "Facebook", icon: "FB", svgIcon: "facebook" },
  {
    host: "instagram.com",
    label: "Instagram",
    icon: "IG",
    svgIcon: "instagram",
  },
  { host: "reddit.com", label: "Reddit", icon: "R", svgIcon: "reddit" },
  { host: "discord.com", label: "Discord", icon: "D", svgIcon: "discord" },
  { host: "whatsapp.com", label: "WhatsApp", icon: "WA", svgIcon: "whatsapp" },
  { host: "slack.com", label: "Slack", icon: "S", svgIcon: "slack" },
  { host: "youtube.com", label: "YouTube", icon: "YT", svgIcon: "youtube" },
  { host: "amazon.com", label: "Amazon", icon: "AZ", svgIcon: "amazon" },
  {
    host: "wikipedia.org",
    label: "Wikipedia",
    icon: "W",
    svgIcon: "wikipedia",
  },
  { host: "medium.com", label: "Medium", icon: "M", svgIcon: "medium" },
  {
    host: "drive.google.com",
    label: "Google Drive",
    icon: "GD",
    svgIcon: "google-drive",
  },
  { host: "notion.so", label: "Notion", icon: "N", svgIcon: "notion" },
  {
    host: "microsoft.com",
    label: "Microsoft",
    icon: "MS",
    svgIcon: "microsoft",
  },
  {
    host: "chatgpt.com",
    label: "ChatGPT",
    icon: "CG",
    svgIcon: "openai-chatgpt",
  },
  { host: "claude.ai", label: "Claude", icon: "CL", svgIcon: "claude" },
  {
    host: "gemini.google.com",
    label: "Gemini",
    icon: "GE",
    svgIcon: "google-gemini",
  },
  {
    host: "perplexity.ai",
    label: "Perplexity",
    icon: "PX",
    svgIcon: "perplexity",
  },
];

export const DEFAULT_SETTINGS: StyleShiftSettings = {
  fontFamily: "",
  monoFontFamily: DEFAULT_MONO_FONT,
  fontEnabled: false,
  cssEnabled: true,
  customCSS: "",
};

export const TYPOGRAPHY_KEY = "__styleshift_typography__";

export type TypographySettings = {
  /** Unitless line-height multiplier, e.g. 1.6. */
  lineHeight: number | null;
  /** Letter spacing in em, e.g. 0.01. */
  letterSpacing: number | null;
  /** CSS font-weight, 100-900. */
  fontWeight: number | null;
  /**
   * Minimum font size in px. NOT emitted as CSS - a `max(Npx, 1em)` rule
   * re-resolves against the parent's already-overridden size once
   * `!important` wins, collapsing every element in the subtree to exactly
   * the minimum. Applied instead via chrome.fontSettings (see min-font-size.ts).
   */
  minFontSize: number | null;
};

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  lineHeight: null,
  letterSpacing: null,
  fontWeight: null,
  minFontSize: null,
};

export const TYPOGRAPHY_RANGES = {
  lineHeight: { min: 1, max: 3 },
  letterSpacing: { min: -0.05, max: 0.5 },
  fontWeight: { min: 100, max: 900 },
  minFontSize: { min: 8, max: 32 },
} as const;

function clampTypographyField(
  value: unknown,
  range: { min: number; max: number },
  decimals: number,
): number | null {
  // Only a genuine finite number is accepted - a numeric string or NaN
  // degrades to "unset" rather than being coerced, so emitted CSS can never
  // contain anything but a clamped, finite number.
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const clamped = Math.min(range.max, Math.max(range.min, value));
  const factor = 10 ** decimals;
  return Math.round(clamped * factor) / factor;
}

// The ONLY path a number takes from storage/import/UI into emitted CSS.
// Clamps out-of-range and non-finite input to null rather than throwing, so a
// corrupted key or a hand-edited import degrades to "unset", never to broken
// CSS or a crash.
export function normalizeTypography(raw: unknown): TypographySettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof TypographySettings, unknown>
  >;

  return {
    lineHeight: clampTypographyField(
      source.lineHeight,
      TYPOGRAPHY_RANGES.lineHeight,
      2,
    ),
    letterSpacing: clampTypographyField(
      source.letterSpacing,
      TYPOGRAPHY_RANGES.letterSpacing,
      3,
    ),
    fontWeight: clampTypographyField(
      source.fontWeight,
      TYPOGRAPHY_RANGES.fontWeight,
      0,
    ),
    minFontSize: clampTypographyField(
      source.minFontSize,
      TYPOGRAPHY_RANGES.minFontSize,
      0,
    ),
  };
}

// line-height/letter-spacing are grouped into one rule; font-weight is
// separate because it targets a narrower selector (headings excluded).
function typographyRules(typography: TypographySettings): string[] {
  const rules: string[] = [];
  const proseDeclarations: string[] = [];

  if (typography.lineHeight !== null) {
    proseDeclarations.push(`line-height: ${typography.lineHeight} !important;`);
  }

  if (typography.letterSpacing !== null) {
    proseDeclarations.push(
      `letter-spacing: ${typography.letterSpacing}em !important;`,
    );
  }

  if (proseDeclarations.length > 0) {
    rules.push(`${PROSE_TARGET_SELECTOR} { ${proseDeclarations.join(" ")} }`);
  }

  if (typography.fontWeight !== null) {
    rules.push(
      `${PROSE_WEIGHT_TARGET_SELECTOR} { font-weight: ${typography.fontWeight} !important; }`,
    );
  }

  return rules;
}

export const FONT_STYLE_ID = "styleshift-font";
export const CSS_STYLE_ID = "styleshift-css";
export const CUSTOM_FONTS_STYLE_ID = "styleshift-custom-fonts";

// Shared exclusion tail: icons, code/mono content, and aria-hidden elements
// are never text-styling targets, whichever base selector they're appended to.
export const TARGET_EXCLUSIONS = [
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
].join("");

export const TEXT_TARGET_SELECTOR = `:where(body, body *)${TARGET_EXCLUSIONS}`;

// Block-level prose containers. line-height/letter-spacing/font-weight all
// inherit, so targeting these and letting the value cascade into whatever's
// unstyled underneath is the only selector strategy that doesn't also have to
// enumerate every element that (ab)uses line-height for non-typographic
// layout (e.g. a nav link's vertical-centering hack) - see the "Prose
// selector redesign" note in style-core.test.ts for the full reasoning.
const PROSE_ELEMENTS = [
  "body",
  "p",
  "li",
  "dd",
  "dt",
  "blockquote",
  "figcaption",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

export const PROSE_TARGET_SELECTOR = PROSE_ELEMENTS.map(
  (el) => `${el}${TARGET_EXCLUSIONS}`,
).join(", ");

// Headings excluded: targeting them directly would flatten the page's
// heading hierarchy to the body weight. Left untouched, the page's own
// `h1..h6 { font-weight: bold }` keeps winning over the inherited value.
export const PROSE_WEIGHT_TARGET_SELECTOR = PROSE_ELEMENTS.filter(
  (el) => !/^h[1-6]$/.test(el),
)
  .map((el) => `${el}${TARGET_EXCLUSIONS}`)
  .join(", ");

export const CODE_TARGET_SELECTOR =
  "code, code *, pre, pre *, kbd, kbd *, samp, samp *, tt, tt *, [class*='code' i], [class*='code' i] *, [class*='monospace' i], [class*='monospace' i] *, [class*='highlight' i], [class*='highlight' i] *";

export const FORM_TEXT_TARGET_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "[contenteditable='true']",
  "[contenteditable='true'] *",
  "[role='textbox']",
  "[role='textbox'] *",
].join(", ");

export const EDITABLE_SELECTOR =
  "input, textarea, select, button, [contenteditable='true'], [role='textbox']";

export function parseFontStack(fontFamily: string): string[] {
  return fontFamily
    .split(",")
    .map((font) => font.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function formatFontFamily(fontFamily: string): string {
  const normalized = fontFamily.trim().replace(/,/g, "");

  if (!normalized) {
    return "";
  }

  if (
    /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)$/i.test(
      normalized,
    )
  ) {
    return normalized;
  }

  return /\s/.test(normalized)
    ? `"${normalized.replace(/"/g, '\\"')}"`
    : normalized;
}

export function serializeFontStack(fontStack: string[]): string {
  return fontStack.map(formatFontFamily).filter(Boolean).join(", ");
}

export function getHostname(url?: string): string {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function getMainDomain(hostname: string): string {
  if (!hostname) {
    return "";
  }

  const parts = hostname.split(".");
  if (parts.length <= 2) {
    return hostname;
  }

  const twoPartTLDs = [
    "co.uk",
    "co.jp",
    "co.kr",
    "co.nz",
    "co.in",
    "co.za",
    "com.au",
    "com.br",
    "com.cn",
    "com.mx",
    "com.tr",
    "com.tw",
    "com.sg",
    "org.uk",
    "net.au",
    "ac.uk",
    "gov.uk",
  ];

  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTLDs.includes(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

export function hostMatchesPreset(
  hostname: string,
  presetHost: string,
): boolean {
  return hostname === presetHost || hostname.endsWith(`.${presetHost}`);
}

export function isPreActivatedHost(hostname: string): boolean {
  return POPULAR_SITE_PRESETS.some((preset) =>
    hostMatchesPreset(hostname, preset.host),
  );
}

export function isInjectableUrl(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function primaryFontFamily(fontFamily: string): string {
  return (
    fontFamily
      .split(",")[0]
      ?.trim()
      .replace(/^['"]|['"]$/g, "") ?? ""
  );
}

export function isLocalFontAvailable(fontFamily: string): boolean {
  const primaryFamily = fontFamily.trim().replace(/^['"]|['"]$/g, "");

  if (!primaryFamily || !document.fonts?.check) {
    return false;
  }

  const escapedFamily = primaryFamily
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return document.fonts.check(`12px "${escapedFamily}"`);
}

export function availableFontStack(
  fontFamily: string,
  customFontNames: string[] = [],
): string[] {
  const customFontSet = new Set(
    customFontNames.map((font) => font.toLowerCase()),
  );
  return parseFontStack(fontFamily).filter(
    (font) =>
      customFontSet.has(font.toLowerCase()) || isLocalFontAvailable(font),
  );
}

export function fontStyleText(
  settings: StyleShiftSettings,
  customFontNames: string[] = [],
  typography: TypographySettings = DEFAULT_TYPOGRAPHY,
): string {
  const availableFonts = availableFontStack(
    settings.fontFamily,
    customFontNames,
  );
  const availableMonoFonts = availableFontStack(
    settings.monoFontFamily,
    customFontNames,
  );

  if (!settings.fontEnabled) {
    return "";
  }

  const rules: string[] = [];

  if (settings.fontFamily.trim() && availableFonts.length > 0) {
    const fontFamily = serializeFontStack(availableFonts);
    rules.push(
      `${TEXT_TARGET_SELECTOR}, ${FORM_TEXT_TARGET_SELECTOR} { font-family: ${fontFamily} !important; }`,
    );
  }

  const monoFontFamily = serializeFontStack(availableMonoFonts);
  if (monoFontFamily) {
    rules.push(
      `${CODE_TARGET_SELECTOR} { font-family: ${monoFontFamily} !important; }`,
    );
  }

  rules.push(...typographyRules(typography));

  return rules.join("\n");
}

export function ensureStyle(
  id: string,
  cssText: string,
  relocateToHead = false,
): void {
  const existing = document.getElementById(id);

  if (!cssText.trim()) {
    existing?.remove();
    return;
  }

  // Rewriting textContent on an existing style element forces the browser to
  // reparse its CSSOM, which throws away any in-progress/loaded @font-face
  // FontFace state and starts the font load over. loadAndApply() runs on
  // every SPA navigation, focus change, and DOM mutation, so without this
  // guard a bundled/custom web font would never get a chance to finish
  // loading - document.fonts.check() would keep seeing a freshly reset,
  // still-loading font and drop it from the applied stack. Skipping the
  // write when content is unchanged keeps already-loaded fonts loaded.
  if (existing) {
    if (existing.textContent !== cssText) {
      existing.textContent = cssText;
    }

    // The content script runs at document_start, so the first injection can
    // happen before <head> exists and lands on <html> instead. That is early
    // enough to prevent a flash of the page's own font, but it also places the
    // rules *before* the page's stylesheets, where they would lose every
    // specificity tie they currently win. Once <head> exists, move the element
    // there so it ends up last, exactly where document_end used to put it.
    //
    // Only relocate rule sheets: moving a sheet re-inserts it, which resets
    // any @font-face loads it declares (see the note above), and the font
    // sheets do not need the position because their rules are !important.
    if (
      relocateToHead &&
      document.head &&
      existing.parentNode !== document.head
    ) {
      document.head.append(existing);
    }
    return;
  }

  const style = document.createElement("style");
  style.id = id;
  style.textContent = cssText;
  (document.head || document.documentElement).append(style);
}

export function applySettings(
  settings: StyleShiftSettings,
  customFontNames: string[] = [],
  typography: TypographySettings = DEFAULT_TYPOGRAPHY,
): void {
  ensureStyle(
    FONT_STYLE_ID,
    fontStyleText(settings, customFontNames, typography),
  );
  // `cssEnabled !== false` rather than a truthiness test: settings stored
  // before the per-host CSS toggle existed have no such key, and those must
  // keep applying their CSS.
  ensureStyle(
    CSS_STYLE_ID,
    settings.cssEnabled !== false ? settings.customCSS : "",
    true,
  );
}

export function removeInjectedStyles(): void {
  document.getElementById(FONT_STYLE_ID)?.remove();
  document.getElementById(CSS_STYLE_ID)?.remove();
  document.getElementById(CUSTOM_FONTS_STYLE_ID)?.remove();
}

export function removeCSS(): void {
  document.getElementById(CSS_STYLE_ID)?.remove();
}

// Escapes a string so it is safe to embed inside a single-quoted CSS string
// (e.g. a font-family name). Custom font names are user-supplied, so without
// this a name containing a quote could terminate the string early and inject
// arbitrary CSS into the injected <style>.
function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// A file extension is not a CSS format hint: `format('ttf')` and
// `format('otf')` are invalid, and a browser drops the entire @font-face rule
// when it cannot parse the hint - so uploaded .ttf/.otf fonts silently never
// applied. Map each accepted extension to its CSS keyword and MIME type.
const FONT_FORMATS: Record<string, { format: string; mimeType: string }> = {
  woff2: { format: "woff2", mimeType: "font/woff2" },
  woff: { format: "woff", mimeType: "font/woff" },
  ttf: { format: "truetype", mimeType: "font/ttf" },
  otf: { format: "opentype", mimeType: "font/otf" },
};

export function fontFormatHint(format: string): {
  format: string;
  mimeType: string;
} {
  return FONT_FORMATS[format.trim().toLowerCase()] ?? FONT_FORMATS.woff2;
}

export function generateCustomFontFace(font: CustomFont): string {
  const { format, mimeType } = fontFormatHint(font.format);
  // base64 data is restricted to [A-Za-z0-9+/=]; strip anything else so a
  // crafted payload cannot break out of the url() value.
  const safeData = font.data.replace(/[^A-Za-z0-9+/=]/g, "");
  return `@font-face {
  font-family: '${escapeCssString(font.name)}';
  font-display: swap;
  src: url('data:${mimeType};base64,${safeData}') format('${format}');
}`;
}

export function customFontFaces(fonts: Record<string, CustomFont>): string {
  return Object.values(fonts).map(generateCustomFontFace).join("\n\n");
}
