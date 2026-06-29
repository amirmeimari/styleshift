// Pure, chrome-free styling logic shared by the content script, the popup, and
// the page-injection path. Keep this module free of any `chrome.*` access so it
// can run in the page context and be unit-tested without an extension host.

export type StyleShiftSettings = {
  fontFamily: string;
  monoFontFamily: string;
  fontEnabled: boolean;
  customCSS: string;
  fabricizeEnabled: boolean;
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
  monoFontFamily: "MonoLisa",
  fontEnabled: false,
  customCSS: "",
  fabricizeEnabled: false,
};

export const FONT_STYLE_ID = "styleshift-font";
export const CSS_STYLE_ID = "styleshift-css";
export const CUSTOM_FONTS_STYLE_ID = "styleshift-custom-fonts";
export const FABRICIZE_STYLE_ID = "styleshift-fabricize";

export const TEXT_TARGET_SELECTOR = [
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
].join("");

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
): string {
  const availableFonts = availableFontStack(
    settings.fontFamily,
    customFontNames,
  );
  const availableMonoFonts = availableFontStack(
    settings.monoFontFamily,
    customFontNames,
  );

  if (
    !settings.fontEnabled ||
    !settings.fontFamily.trim() ||
    availableFonts.length === 0
  ) {
    return "";
  }

  const fontFamily = serializeFontStack(availableFonts);
  const monoFontFamily = serializeFontStack(availableMonoFonts);
  const monoRule = monoFontFamily
    ? `\n${CODE_TARGET_SELECTOR} { font-family: ${monoFontFamily} !important; }`
    : "";

  return `${TEXT_TARGET_SELECTOR}, ${FORM_TEXT_TARGET_SELECTOR} { font-family: ${fontFamily} !important; }${monoRule}`;
}

export function ensureStyle(id: string, cssText: string): void {
  const existing = document.getElementById(id);

  if (!cssText.trim()) {
    existing?.remove();
    return;
  }

  const style = existing ?? document.createElement("style");
  style.id = id;
  style.textContent = cssText;

  if (!existing) {
    (document.head || document.documentElement).append(style);
  }
}

export function fabricizeCSS(): string {
  return `
:root {
  --fabric-canvas: #EFE3CF;
  --fabric-linen: #E4D3BB;
  --fabric-raised: #D8C1A3;
  --fabric-accent-surface: #C9B18F;
  --fabric-denim: #2D4263;
  --fabric-denim-light: #4F6588;
  --fabric-olive: #7A7D52;
  --fabric-terracotta: #B66E5A;
  --fabric-mustard: #D4A74E;
  --fabric-leather: #7A5538;
  --fabric-stitch: #A38362;
  --fabric-blue-thread: #3D5B8B;
  --fabric-red-thread: #A04A42;
  --fabric-green-thread: #5C7D58;
  --fabric-rose: #C78B83;
  --fabric-text: #2E241D;
  --fabric-text-secondary: #645446;
  --fabric-text-muted: #8D7C6A;
  --fabric-border: #C3A98D;
}

body {
  background-color: var(--fabric-canvas) !important;
  color: var(--fabric-text) !important;
  background-image:
    repeating-linear-gradient(90deg, rgba(120,90,55,.06) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(0deg, rgba(255,250,240,.1) 0 1px, transparent 1px 4px) !important;
  background-size: 4px 4px !important;
}

h1, h2, h3, h4, h5, h6 {
  color: var(--fabric-text) !important;
}

p, span, li, td, th, dd, dt, figcaption, blockquote, cite, label, legend {
  color: var(--fabric-text) !important;
}

a, a:visited {
  color: var(--fabric-blue-thread) !important;
}

a:hover {
  color: var(--fabric-denim) !important;
}

header, nav, [role="banner"], [role="navigation"] {
  background-color: var(--fabric-linen) !important;
  border-bottom: 1.3px dashed var(--fabric-stitch) !important;
}

footer, [role="contentinfo"] {
  background-color: var(--fabric-linen) !important;
  border-top: 1.3px dashed var(--fabric-stitch) !important;
}

main, article, section, [role="main"] {
  background-color: var(--fabric-canvas) !important;
}

aside, [role="complementary"] {
  background-color: var(--fabric-linen) !important;
}

div[class*="card" i], div[class*="panel" i], div[class*="tile" i],
div[class*="widget" i], div[class*="module" i], div[class*="block" i] {
  background-color: var(--fabric-linen) !important;
  border: 1px solid var(--fabric-border) !important;
  border-radius: 0.625rem !important;
  box-shadow: 0 3px 6px rgba(68,42,22,.08), 0 8px 24px rgba(68,42,22,.12) !important;
}

button, [role="button"],
input[type="submit"], input[type="button"], input[type="reset"] {
  background-color: var(--fabric-denim) !important;
  color: #F8F3EA !important;
  border: 1px solid #1D2F4A !important;
  border-radius: 0.625rem !important;
  box-shadow: 0 2px 4px rgba(68,42,22,.18), inset 0 1px 0 rgba(255,255,255,.12) !important;
  transition: transform 150ms ease, box-shadow 150ms ease !important;
}

button:hover, [role="button"]:hover,
input[type="submit"]:hover, input[type="button"]:hover {
  transform: translateY(-1px) !important;
}

button:active, [role="button"]:active,
input[type="submit"]:active, input[type="button"]:active {
  transform: translateY(1px) !important;
  box-shadow: inset 0 2px 4px rgba(0,0,0,.18) !important;
}

input[type="text"], input[type="email"], input[type="password"],
input[type="search"], input[type="url"], input[type="tel"],
input[type="number"], input[type="date"], input[type="time"],
textarea, select {
  background-color: var(--fabric-canvas) !important;
  color: var(--fabric-text) !important;
  border: 1px solid var(--fabric-border) !important;
  border-radius: 0.625rem !important;
  box-shadow: inset 0 2px 4px rgba(68,42,22,.06) !important;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--fabric-blue-thread) !important;
  outline: 2px solid var(--fabric-blue-thread) !important;
  outline-offset: 1px !important;
}

input[type="checkbox"]:checked, input[type="radio"]:checked {
  accent-color: var(--fabric-olive) !important;
}

table {
  border-collapse: collapse !important;
}

th {
  background-color: var(--fabric-raised) !important;
  color: var(--fabric-text) !important;
  border: 1px solid var(--fabric-border) !important;
}

td {
  background-color: var(--fabric-canvas) !important;
  border: 1px solid var(--fabric-border) !important;
}

tr:nth-child(even) td {
  background-color: var(--fabric-linen) !important;
}

hr {
  border: none !important;
  height: 1px !important;
  background: repeating-linear-gradient(90deg, var(--fabric-stitch) 0 5px, transparent 5px 10px) !important;
  opacity: 0.5 !important;
}

::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
}

::-webkit-scrollbar-track {
  background: var(--fabric-canvas) !important;
}

::-webkit-scrollbar-thumb {
  background: var(--fabric-stitch) !important;
  border-radius: 4px !important;
}

::selection {
  background-color: var(--fabric-mustard) !important;
  color: #2E241D !important;
}

img, video, svg, canvas {
  border-radius: 0.375rem !important;
}

[class*="badge" i], [class*="tag" i], [class*="chip" i], [class*="pill" i] {
  background-color: var(--fabric-linen) !important;
  color: var(--fabric-text) !important;
  border: 1px solid var(--fabric-stitch) !important;
  border-radius: 0.625rem !important;
}

[class*="modal" i], [class*="dialog" i], [class*="popup" i], [class*="dropdown" i],
[class*="popover" i], [class*="tooltip" i], [role="dialog"], [role="menu"],
[role="listbox"] {
  background-color: var(--fabric-linen) !important;
  border: 1px solid var(--fabric-border) !important;
  border-radius: 0.625rem !important;
  box-shadow: 0 8px 16px rgba(68,42,22,.14), 0 16px 40px rgba(68,42,22,.18) !important;
}

[class*="alert" i][class*="error" i], [class*="alert" i][class*="danger" i] {
  background-color: var(--fabric-terracotta) !important;
  color: #FFF6F2 !important;
  border: 1px solid #8f4b3c !important;
}

[class*="alert" i][class*="success" i] {
  background-color: var(--fabric-olive) !important;
  color: #F5F1E8 !important;
  border: 1px solid #5d6040 !important;
}

[class*="alert" i][class*="warn" i] {
  background-color: var(--fabric-mustard) !important;
  color: #3E2E16 !important;
  border: 1px solid #a87f2f !important;
}
`.trim();
}

export function applySettings(
  settings: StyleShiftSettings,
  customFontNames: string[] = [],
): void {
  ensureStyle(FONT_STYLE_ID, fontStyleText(settings, customFontNames));
  ensureStyle(CSS_STYLE_ID, settings.customCSS);
  ensureStyle(
    FABRICIZE_STYLE_ID,
    settings.fabricizeEnabled ? fabricizeCSS() : "",
  );
}

export function removeInjectedStyles(): void {
  document.getElementById(FONT_STYLE_ID)?.remove();
  document.getElementById(CSS_STYLE_ID)?.remove();
  document.getElementById(CUSTOM_FONTS_STYLE_ID)?.remove();
  document.getElementById(FABRICIZE_STYLE_ID)?.remove();
}

export function removeCSS(): void {
  document.getElementById(CSS_STYLE_ID)?.remove();
}

export function generateCustomFontFace(font: CustomFont): string {
  const fontFormat = font.format === "woff2" ? "woff2" : font.format || "woff2";
  return `@font-face {
  font-family: '${font.name}';
  src: url('data:application/${fontFormat};base64,${font.data}') format('${fontFormat}');
}`;
}

export function customFontFaces(fonts: Record<string, CustomFont>): string {
  return Object.values(fonts).map(generateCustomFontFace).join("\n\n");
}
