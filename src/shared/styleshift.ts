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
export const CUSTOM_FONTS_KEY = "__styleshift_custom_fonts__";
export const CUSTOM_FONT_INDEX_KEY = "__styleshift_custom_font_index__";
export const CUSTOM_FONT_CHUNK_PREFIX = "__styleshift_custom_font_chunk__";
export const CUSTOM_FONT_CHUNK_SIZE = 7000;
export const POPULAR_SITE_PRESETS = [
  { host: "google.com", label: "Google", icon: "G", svgIcon: "google" },
  { host: "mail.google.com", label: "Gmail", icon: "GM", svgIcon: "gmail-2026" },
  { host: "maps.google.com", label: "Maps", icon: "MP", svgIcon: "google-maps" },
  { host: "docs.google.com", label: "Google Docs", icon: "GD", svgIcon: "google-docs-2026" },
  { host: "github.com", label: "GitHub", icon: "GH", svgIcon: "github" },
  { host: "stackoverflow.com", label: "Stack Overflow", icon: "SO", svgIcon: "stack-overflow" },
  { host: "figma.com", label: "Figma", icon: "F", svgIcon: "figma" },
  { host: "npmjs.com", label: "npm", icon: "NP", svgIcon: "npm" },
  { host: "linkedin.com", label: "LinkedIn", icon: "IN", svgIcon: "linkedin" },
  { host: "x.com", label: "X", icon: "X", svgIcon: "x" },
  { host: "facebook.com", label: "Facebook", icon: "FB", svgIcon: "facebook" },
  { host: "instagram.com", label: "Instagram", icon: "IG", svgIcon: "instagram" },
  { host: "reddit.com", label: "Reddit", icon: "R", svgIcon: "reddit" },
  { host: "discord.com", label: "Discord", icon: "D", svgIcon: "discord" },
  { host: "whatsapp.com", label: "WhatsApp", icon: "WA", svgIcon: "whatsapp" },
  { host: "slack.com", label: "Slack", icon: "S", svgIcon: "slack" },
  { host: "youtube.com", label: "YouTube", icon: "YT", svgIcon: "youtube" },
  { host: "amazon.com", label: "Amazon", icon: "AZ", svgIcon: "amazon" },
  { host: "wikipedia.org", label: "Wikipedia", icon: "W", svgIcon: "wikipedia" },
  { host: "medium.com", label: "Medium", icon: "M", svgIcon: "medium" },
  { host: "drive.google.com", label: "Google Drive", icon: "GD", svgIcon: "google-drive" },
  { host: "notion.so", label: "Notion", icon: "N", svgIcon: "notion" },
  { host: "microsoft.com", label: "Microsoft", icon: "MS", svgIcon: "microsoft" },
  { host: "chatgpt.com", label: "ChatGPT", icon: "CG", svgIcon: "openai-chatgpt" },
  { host: "claude.ai", label: "Claude", icon: "CL", svgIcon: "claude" },
  { host: "gemini.google.com", label: "Gemini", icon: "GE", svgIcon: "google-gemini" },
  { host: "perplexity.ai", label: "Perplexity", icon: "PX", svgIcon: "perplexity" },
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

export function parseFontStack(fontFamily: string) {
  return fontFamily
    .split(",")
    .map((font) => font.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function formatFontFamily(fontFamily: string) {
  const normalized = fontFamily.trim().replace(/,/g, "");

  if (!normalized) {
    return "";
  }

  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)$/i.test(normalized)) {
    return normalized;
  }

  return /\s/.test(normalized) ? `"${normalized.replace(/"/g, '\\"')}"` : normalized;
}

export function serializeFontStack(fontStack: string[]) {
  return fontStack.map(formatFontFamily).filter(Boolean).join(", ");
}

export function getHostname(url?: string) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
}

export function hostMatchesPreset(hostname: string, presetHost: string) {
  return hostname === presetHost || hostname.endsWith(`.${presetHost}`);
}

export function isPreActivatedHost(hostname: string) {
  return POPULAR_SITE_PRESETS.some((preset) =>
    hostMatchesPreset(hostname, preset.host),
  );
}

export function isInjectableUrl(url?: string) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function primaryFontFamily(fontFamily: string) {
  const primaryFamily = fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return primaryFamily ?? "";
}

export function isLocalFontAvailable(fontFamily: string) {
  const primaryFamily = fontFamily.trim().replace(/^['"]|['"]$/g, "");

  if (!primaryFamily || !document.fonts?.check) {
    return false;
  }

  const escapedFamily = primaryFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return document.fonts.check(`12px "${escapedFamily}"`);
}

export function availableFontStack(fontFamily: string, customFontNames: string[] = []) {
  const customFontSet = new Set(customFontNames.map((font) => font.toLowerCase()));
  return parseFontStack(fontFamily).filter(
    (font) => customFontSet.has(font.toLowerCase()) || isLocalFontAvailable(font),
  );
}

export function fontStyleText(
  settings: StyleShiftSettings,
  customFontNames: string[] = [],
) {
  const availableFonts = availableFontStack(settings.fontFamily, customFontNames);
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

export function ensureStyle(id: string, cssText: string) {
  const existing = document.getElementById(id);

  if (!cssText.trim()) {
    existing?.remove();
    return;
  }

  const style = existing ?? document.createElement("style");
  style.id = id;
  style.textContent = cssText;

  if (!existing) {
    document.head.append(style);
  }
}

export function applySettings(settings: StyleShiftSettings) {
  ensureStyle(FONT_STYLE_ID, fontStyleText(settings));
  ensureStyle(CSS_STYLE_ID, settings.customCSS);
}

export function removeInjectedStyles() {
  document.getElementById(FONT_STYLE_ID)?.remove();
  document.getElementById(CSS_STYLE_ID)?.remove();
  document.getElementById(CUSTOM_FONTS_STYLE_ID)?.remove();
}

export function removeCSS() {
  document.getElementById(CSS_STYLE_ID)?.remove();
}

export async function readGlobalEnabled() {
  const stored = (await chrome.storage.local.get(GLOBAL_ENABLED_KEY)) as Record<
    string,
    boolean | undefined
  >;
  return stored[GLOBAL_ENABLED_KEY] ?? true;
}

export async function updateGlobalEnabled(enabled: boolean) {
  await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: enabled });
}

export async function readGlobalFontStack() {
  const stored = (await chrome.storage.local.get(GLOBAL_FONT_STACK_KEY)) as Record<
    string,
    string[] | undefined
  >;
  return stored[GLOBAL_FONT_STACK_KEY] ?? [];
}

export async function updateGlobalFontStack(fontStack: string[]) {
  await chrome.storage.local.set({ [GLOBAL_FONT_STACK_KEY]: fontStack });
}

export async function readGlobalMonoFontStack() {
  const stored = (await chrome.storage.local.get(GLOBAL_MONO_FONT_STACK_KEY)) as Record<
    string,
    string[] | undefined
  >;
  return stored[GLOBAL_MONO_FONT_STACK_KEY] ?? ["MonoLisa"];
}

export async function updateGlobalMonoFontStack(fontStack: string[]) {
  await chrome.storage.local.set({ [GLOBAL_MONO_FONT_STACK_KEY]: fontStack });
}

export async function readHostSettings(hostname: string) {
  const stored = (await chrome.storage.local.get(hostname)) as StyleShiftStorage;
  const storedSettings = stored[hostname];
  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    fontEnabled: storedSettings?.fontEnabled ?? isPreActivatedHost(hostname),
  };
}

export async function updateHostSettings(
  hostname: string,
  settings: StyleShiftSettings,
) {
  await chrome.storage.local.set({ [hostname]: settings });
}

export async function getActiveTab() {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    throw new Error("Open StyleShift as a Chrome extension.");
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  if (!isInjectableUrl(tab.url)) {
    throw new Error("StyleShift is not available on this page.");
  }

  return tab;
}

export async function injectSettings(
  tabId: number | undefined,
  settings: StyleShiftSettings,
  globalEnabled = true,
) {
  if (!tabId) {
    return;
  }

  const customFonts = await readCustomFonts();
  const customFontNames = Object.values(customFonts).map((font) => font.name);
  const customFontStyles = Object.values(customFonts)
    .map(generateCustomFontFace)
    .join("\n\n");

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (
      nextSettings: StyleShiftSettings,
      fontId: string,
      cssId: string,
      enabled: boolean,
      customFontsId: string,
      customFaces: string,
      customNames: string[],
    ) => {
      const ensure = (id: string, cssText: string) => {
        const existing = document.getElementById(id);

        if (!cssText.trim()) {
          existing?.remove();
          return;
        }

        const style = existing ?? document.createElement("style");
        style.id = id;
        style.textContent = cssText;

        if (!existing) {
          document.head.append(style);
        }
      };

      if (!enabled) {
        document.getElementById(fontId)?.remove();
        document.getElementById(cssId)?.remove();
        document.getElementById(customFontsId)?.remove();
        return;
      }

      ensure(customFontsId, customFaces);

      const localFontAvailable = (fontFamily: string) => {
        const primaryFamily = fontFamily.trim().replace(/^['"]|['"]$/g, "");

        if (!primaryFamily || !document.fonts?.check) {
          return false;
        }

        const escapedFamily = primaryFamily
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"');

        return document.fonts.check(`12px "${escapedFamily}"`);
      };
      const format = (fontFamily: string) => {
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
      };
      const customFontSet = new Set(
        customNames.map((font) => font.toLowerCase()),
      );
      const buildStack = (fontFamily: string) =>
        fontFamily
          .split(",")
          .map((font) => font.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean)
          .filter(
            (font) =>
              customFontSet.has(font.toLowerCase()) || localFontAvailable(font),
          )
          .map(format)
          .filter(Boolean)
          .join(", ");

      const fontStack = buildStack(nextSettings.fontFamily);
      const monoFontStack = buildStack(nextSettings.monoFontFamily);
      const textTargetSelector = `:where(body, body *):not(i):not(i *):not(svg):not(svg *):not(code):not(code *):not(pre):not(pre *):not(kbd):not(kbd *):not(samp):not(samp *):not(tt):not(tt *):not([class*='icon' i]):not([class*='icon' i] *):not([class*='material-icons' i]):not([class*='material-icons' i] *):not([class*='google-symbols' i]):not([class*='google-symbols' i] *):not([style*='Google Symbols' i]):not([class^='fa-']):not([class*=' fa-']):not([role='img']):not([role='img'] *):not([aria-hidden='true']):not([aria-hidden='true'] *)`;
      const codeTargetSelector =
        "code, code *, pre, pre *, kbd, kbd *, samp, samp *, tt, tt *, [class*='code' i], [class*='code' i] *, [class*='monospace' i], [class*='monospace' i] *, [class*='highlight' i], [class*='highlight' i] *";
      const formTextTargetSelector =
        "input, textarea, select, button, [contenteditable='true'], [contenteditable='true'] *, [role='textbox'], [role='textbox'] *";
      const monoRule = monoFontStack
        ? `\n${codeTargetSelector} { font-family: ${monoFontStack} !important; }`
        : "";
      const fontCSS =
        nextSettings.fontEnabled &&
        nextSettings.fontFamily.trim() &&
        fontStack
          ? `${textTargetSelector}, ${formTextTargetSelector} { font-family: ${fontStack} !important; }${monoRule}`
          : "";

      ensure(fontId, fontCSS);
      ensure(cssId, nextSettings.customCSS);
    },
    args: [
      settings,
      FONT_STYLE_ID,
      CSS_STYLE_ID,
      globalEnabled,
      CUSTOM_FONTS_STYLE_ID,
      customFontStyles,
      customFontNames,
    ],
  });
}

export async function removeInjectedStylesFromTab(tabId: number | undefined) {
  if (!tabId) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (fontId, cssId) => {
      document.getElementById(fontId)?.remove();
      document.getElementById(cssId)?.remove();
      document.getElementById("styleshift-custom-fonts")?.remove();
    },
    args: [FONT_STYLE_ID, CSS_STYLE_ID],
  });
}

export async function syncGlobalEnabledAcrossTabs(enabled: boolean) {
  const tabs = await chrome.tabs.query({});
  const fontStack = await readGlobalFontStack();
  const monoFontStack = await readGlobalMonoFontStack();
  const globalFontFamily = serializeFontStack(fontStack);
  const globalMonoFontFamily = serializeFontStack(monoFontStack);

  await Promise.allSettled(
    tabs.map(async (tab) => {
      if (!isInjectableUrl(tab.url)) {
        return;
      }

      const hostname = getHostname(tab.url);

      if (!hostname || !tab.id) {
        return;
      }

      if (!enabled) {
        await removeInjectedStylesFromTab(tab.id);
        return;
      }

      const settings = {
        ...(await readHostSettings(hostname)),
        fontFamily: globalFontFamily,
        monoFontFamily: globalMonoFontFamily,
      };
      await injectSettings(tab.id, settings, true);
    }),
  );
}

export async function syncGlobalFontStackAcrossTabs(fontStack: string[]) {
  const tabs = await chrome.tabs.query({});
  const enabled = await readGlobalEnabled();
  const globalFontFamily = serializeFontStack(fontStack);
  const globalMonoFontFamily = serializeFontStack(await readGlobalMonoFontStack());

  await Promise.allSettled(
    tabs.map(async (tab) => {
      if (!isInjectableUrl(tab.url)) {
        return;
      }

      const hostname = getHostname(tab.url);

      if (!hostname || !tab.id) {
        return;
      }

      const settings = {
        ...(await readHostSettings(hostname)),
        fontFamily: globalFontFamily,
        monoFontFamily: globalMonoFontFamily,
      };
      await injectSettings(tab.id, settings, enabled);
    }),
  );
}

export async function syncGlobalMonoFontStackAcrossTabs(fontStack: string[]) {
  const tabs = await chrome.tabs.query({});
  const enabled = await readGlobalEnabled();
  const globalFontFamily = serializeFontStack(await readGlobalFontStack());
  const globalMonoFontFamily = serializeFontStack(fontStack);

  await Promise.allSettled(
    tabs.map(async (tab) => {
      if (!isInjectableUrl(tab.url)) {
        return;
      }

      const hostname = getHostname(tab.url);

      if (!hostname || !tab.id) {
        return;
      }

      const settings = {
        ...(await readHostSettings(hostname)),
        fontFamily: globalFontFamily,
        monoFontFamily: globalMonoFontFamily,
      };
      await injectSettings(tab.id, settings, enabled);
    }),
  );
}

export async function removeCustomCSS(tabId: number | undefined) {
  if (!tabId) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (cssId) => {
      document.getElementById(cssId)?.remove();
    },
    args: [CSS_STYLE_ID],
  });
}

// Custom font management
type StoredCustomFontMeta = Omit<CustomFont, "data"> & {
  chunks: number;
};

function customFontChunkKey(fontId: string, index: number) {
  return `${CUSTOM_FONT_CHUNK_PREFIX}${fontId}_${index}`;
}

export async function readCustomFonts(): Promise<Record<string, CustomFont>> {
  try {
    const storedIndex = (await chrome.storage.local.get(CUSTOM_FONT_INDEX_KEY)) as Record<
      string,
      Record<string, StoredCustomFontMeta> | undefined
    >;
    const index = storedIndex[CUSTOM_FONT_INDEX_KEY];

    if (index) {
      const chunkKeys = Object.values(index).flatMap((font) =>
        Array.from({ length: font.chunks }, (_, chunkIndex) =>
          customFontChunkKey(font.id, chunkIndex),
        ),
      );
      const chunks = (await chrome.storage.local.get(chunkKeys)) as Record<
        string,
        string | undefined
      >;

      return Object.fromEntries(
        Object.values(index).map((font) => [
          font.id,
          {
            ...font,
            data: Array.from(
              { length: font.chunks },
              (_, chunkIndex) =>
                chunks[customFontChunkKey(font.id, chunkIndex)] ?? "",
            ).join(""),
          },
        ]),
      );
    }

    const legacy = (await chrome.storage.local.get(CUSTOM_FONTS_KEY)) as Record<
      string,
      Record<string, CustomFont> | undefined
    >;
    return legacy[CUSTOM_FONTS_KEY] ?? {};
  } catch {
    return {};
  }
}

export async function updateCustomFont(font: CustomFont) {
  try {
    const storedIndex = (await chrome.storage.local.get(CUSTOM_FONT_INDEX_KEY)) as Record<
      string,
      Record<string, StoredCustomFontMeta> | undefined
    >;
    const index = storedIndex[CUSTOM_FONT_INDEX_KEY] ?? {};
    const oldMeta = index[font.id];

    if (oldMeta) {
      await chrome.storage.local.remove(
        Array.from({ length: oldMeta.chunks }, (_, chunkIndex) =>
          customFontChunkKey(font.id, chunkIndex),
        ),
      );
    }

    const chunks = font.data.match(
      new RegExp(`.{1,${CUSTOM_FONT_CHUNK_SIZE}}`, "g"),
    ) ?? [""];
    index[font.id] = {
      id: font.id,
      name: font.name,
      mimeType: font.mimeType,
      format: font.format,
      chunks: chunks.length,
    };

    await chrome.storage.local.set({ [CUSTOM_FONT_INDEX_KEY]: index });
    for (const [chunkIndex, chunk] of chunks.entries()) {
      await chrome.storage.local.set({
        [customFontChunkKey(font.id, chunkIndex)]: chunk,
      });
    }
    await chrome.storage.local.remove(CUSTOM_FONTS_KEY);
  } catch (error) {
    console.error("Error saving custom font:", error);
    throw error;
  }
}

export async function deleteCustomFont(fontId: string) {
  try {
    const storedIndex = (await chrome.storage.local.get(CUSTOM_FONT_INDEX_KEY)) as Record<
      string,
      Record<string, StoredCustomFontMeta> | undefined
    >;
    const index = storedIndex[CUSTOM_FONT_INDEX_KEY] ?? {};
    const oldMeta = index[fontId];
    delete index[fontId];

    await chrome.storage.local.set({ [CUSTOM_FONT_INDEX_KEY]: index });

    if (oldMeta) {
      await chrome.storage.local.remove(
        Array.from({ length: oldMeta.chunks }, (_, chunkIndex) =>
          customFontChunkKey(fontId, chunkIndex),
        ),
      );
    }
  } catch (error) {
    console.error("Error deleting custom font:", error);
  }
}

export function generateCustomFontFace(font: CustomFont): string {
  const fontFormat = font.format === "woff2" ? "woff2" : font.format || "woff2";
  return `
@font-face {
  font-family: '${font.name}';
  src: url('data:application/${fontFormat};base64,${font.data}') format('${fontFormat}');
}
  `.trim();
}

export async function injectCustomFonts() {
  const fonts = await readCustomFonts();
  const customFontStyles = Object.values(fonts)
    .map(generateCustomFontFace)
    .join("\n\n");

  if (customFontStyles.trim()) {
    const styleId = "styleshift-custom-fonts";
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = customFontStyles;
  }
}
