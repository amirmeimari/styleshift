// Pure, chrome-free styling logic shared by the content script, the popup, and
// the page-injection path. Keep this module free of any `chrome.*` access so it
// can run in the page context and be unit-tested without an extension host.

export type StyleShiftSettings = {
  fontFamily: string;
  monoFontFamily: string;
  fontEnabled: boolean;
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
  monoFontFamily: "MonoLisa",
  fontEnabled: false,
  customCSS: "",
};

export const FONT_STYLE_ID = "styleshift-font";
export const CSS_STYLE_ID = "styleshift-css";
export const CUSTOM_FONTS_STYLE_ID = "styleshift-custom-fonts";

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

  const monoFontFamily = serializeFontStack(availableMonoFonts);
  const monoRule = monoFontFamily
    ? `${CODE_TARGET_SELECTOR} { font-family: ${monoFontFamily} !important; }`
    : "";

  if (!settings.fontFamily.trim() || availableFonts.length === 0) {
    return monoRule;
  }

  const fontFamily = serializeFontStack(availableFonts);
  const mainRule = `${TEXT_TARGET_SELECTOR}, ${FORM_TEXT_TARGET_SELECTOR} { font-family: ${fontFamily} !important; }`;

  return monoRule ? `${mainRule}\n${monoRule}` : mainRule;
}

export function ensureStyle(id: string, cssText: string): void {
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
): void {
  ensureStyle(FONT_STYLE_ID, fontStyleText(settings, customFontNames));
  ensureStyle(CSS_STYLE_ID, settings.customCSS);
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

export function generateCustomFontFace(font: CustomFont): string {
  const fontFormat = font.format === "woff2" ? "woff2" : font.format || "woff2";
  // base64 data is restricted to [A-Za-z0-9+/=]; strip anything else so a
  // crafted payload cannot break out of the url() value.
  const safeData = font.data.replace(/[^A-Za-z0-9+/=]/g, "");
  return `@font-face {
  font-family: '${escapeCssString(font.name)}';
  src: url('data:application/${fontFormat};base64,${safeData}') format('${fontFormat}');
}`;
}

export function customFontFaces(fonts: Record<string, CustomFont>): string {
  return Object.values(fonts).map(generateCustomFontFace).join("\n\n");
}
