type StyleShiftSettings = {
  fontFamily: string;
  monoFontFamily: string;
  fontEnabled: boolean;
  customCSS: string;
};

type StyleShiftStorage = Record<string, StyleShiftSettings>;
type CustomFont = {
  id: string;
  name: string;
  data: string;
  mimeType: string;
  format: string;
};

const GLOBAL_ENABLED_KEY = "__styleshift_enabled__";
const GLOBAL_FONT_STACK_KEY = "__styleshift_font_stack__";
const GLOBAL_MONO_FONT_STACK_KEY = "__styleshift_mono_font_stack__";
const CUSTOM_FONTS_KEY = "__styleshift_custom_fonts__";
const CUSTOM_FONT_INDEX_KEY = "__styleshift_custom_font_index__";
const CUSTOM_FONT_CHUNK_PREFIX = "__styleshift_custom_font_chunk__";

const DEFAULT_SETTINGS: StyleShiftSettings = {
  fontFamily: "",
  monoFontFamily: "MonoLisa",
  fontEnabled: false,
  customCSS: "",
};

const FONT_STYLE_ID = "styleshift-font";
const CSS_STYLE_ID = "styleshift-css";
const CUSTOM_FONTS_STYLE_ID = "styleshift-custom-fonts";
const TEXT_TARGET_SELECTOR = `:where(body, body *):not(i):not(i *):not(svg):not(svg *):not(code):not(code *):not(pre):not(pre *):not(kbd):not(kbd *):not(samp):not(samp *):not(tt):not(tt *):not([class*='icon' i]):not([class*='icon' i] *):not([class*='material-icons' i]):not([class*='material-icons' i] *):not([class*='google-symbols' i]):not([class*='google-symbols' i] *):not([style*='Google Symbols' i]):not([class^='fa-']):not([class*=' fa-']):not([role='img']):not([role='img'] *):not([aria-hidden='true']):not([aria-hidden='true'] *)`;
const CODE_TARGET_SELECTOR =
  "code, code *, pre, pre *, kbd, kbd *, samp, samp *, tt, tt *, textarea, [class*='code' i], [class*='code' i] *, [class*='monospace' i], [class*='monospace' i] *, [class*='highlight' i], [class*='highlight' i] *";

function parseFontStack(fontFamily: string) {
  return fontFamily
    .split(",")
    .map((font) => font.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function formatFontFamily(fontFamily: string) {
  const normalized = fontFamily.trim().replace(/,/g, "");

  if (!normalized) {
    return "";
  }

  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)$/i.test(normalized)) {
    return normalized;
  }

  return /\s/.test(normalized) ? `"${normalized.replace(/"/g, '\\"')}"` : normalized;
}

function serializeFontStack(fontStack: string[]) {
  return fontStack.map(formatFontFamily).filter(Boolean).join(", ");
}

function primaryFontFamily(fontFamily: string) {
  const primaryFamily = fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return primaryFamily ?? "";
}

function isLocalFontAvailable(fontFamily: string) {
  const primaryFamily = fontFamily.trim().replace(/^['"]|['"]$/g, "");

  if (!primaryFamily || !document.fonts?.check) {
    return false;
  }

  const escapedFamily = primaryFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return document.fonts.check(`12px "${escapedFamily}"`);
}

function fontStyleText(settings: StyleShiftSettings, customFontNames: string[]) {
  const customFontSet = new Set(customFontNames.map((font) => font.toLowerCase()));
  const availableFonts = parseFontStack(settings.fontFamily).filter(
    (font) => customFontSet.has(font.toLowerCase()) || isLocalFontAvailable(font),
  );
  const availableMonoFonts = parseFontStack(settings.monoFontFamily).filter(
    (font) => customFontSet.has(font.toLowerCase()) || isLocalFontAvailable(font),
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
  return `${TEXT_TARGET_SELECTOR} { font-family: ${fontFamily} !important; }${monoRule}`;
}

function ensureStyle(id: string, cssText: string) {
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

function applySettings(settings: StyleShiftSettings, customFontNames: string[]) {
  ensureStyle(FONT_STYLE_ID, fontStyleText(settings, customFontNames));
  ensureStyle(CSS_STYLE_ID, settings.customCSS);
}

function removeInjectedStyles() {
  document.getElementById(FONT_STYLE_ID)?.remove();
  document.getElementById(CSS_STYLE_ID)?.remove();
  document.getElementById(CUSTOM_FONTS_STYLE_ID)?.remove();
}

async function injectCustomFonts() {
  try {
    const storedIndex = (await chrome.storage.local.get(CUSTOM_FONT_INDEX_KEY)) as Record<
      string,
      Record<string, Omit<CustomFont, "data"> & { chunks: number }> | undefined
    >;
    const index = storedIndex[CUSTOM_FONT_INDEX_KEY];
    let customFonts: Record<string, CustomFont>;

    if (index) {
      const chunkKeys = Object.values(index).flatMap((font) =>
        Array.from(
          { length: font.chunks },
          (_, chunkIndex) =>
            `${CUSTOM_FONT_CHUNK_PREFIX}${font.id}_${chunkIndex}`,
        ),
      );
      const chunks = (await chrome.storage.local.get(chunkKeys)) as Record<
        string,
        string | undefined
      >;
      customFonts = Object.fromEntries(
        Object.values(index).map((font) => [
          font.id,
          {
            ...font,
            data: Array.from(
              { length: font.chunks },
              (_, chunkIndex) =>
                chunks[`${CUSTOM_FONT_CHUNK_PREFIX}${font.id}_${chunkIndex}`] ??
                "",
            ).join(""),
          },
        ]),
      );
    } else {
      const stored = (await chrome.storage.local.get(CUSTOM_FONTS_KEY)) as Record<
        string,
        Record<string, CustomFont> | undefined
      >;
      customFonts = stored[CUSTOM_FONTS_KEY] ?? {};
    }

    const fontFaces = Object.values(customFonts)
      .map((font) => {
        const fontFormat = font.format === "woff2" ? "woff2" : font.format || "woff2";
        return `@font-face {
  font-family: '${font.name}';
  src: url('data:application/${fontFormat};base64,${font.data}') format('${fontFormat}');
}`;
      })
      .join("\n\n");

    if (fontFaces.trim()) {
      ensureStyle(CUSTOM_FONTS_STYLE_ID, fontFaces);
    }

    return Object.values(customFonts).map((font) => font.name);
  } catch (error) {
    console.error("Error injecting custom fonts:", error);
    return [];
  }
}

async function readGlobalEnabled() {
  const stored = (await chrome.storage.local.get(GLOBAL_ENABLED_KEY)) as Record<
    string,
    boolean | undefined
  >;
  return stored[GLOBAL_ENABLED_KEY] ?? true;
}

async function readGlobalFontStack() {
  const stored = (await chrome.storage.local.get(GLOBAL_FONT_STACK_KEY)) as Record<
    string,
    string[] | undefined
  >;
  return stored[GLOBAL_FONT_STACK_KEY] ?? [];
}

async function readGlobalMonoFontStack() {
  const stored = (await chrome.storage.local.get(GLOBAL_MONO_FONT_STACK_KEY)) as Record<
    string,
    string[] | undefined
  >;
  return stored[GLOBAL_MONO_FONT_STACK_KEY] ?? ["MonoLisa"];
}

async function readHostSettings(hostname: string) {
  const stored = (await chrome.storage.local.get(hostname)) as StyleShiftStorage;
  return { ...DEFAULT_SETTINGS, ...stored[hostname] };
}

async function loadAndApply() {
  const hostname = window.location.hostname;

  if (!hostname) {
    return;
  }

  const globalEnabled = await readGlobalEnabled();

  if (!globalEnabled) {
    removeInjectedStyles();
    return;
  }

  const [settings, globalFontStack, globalMonoFontStack] = await Promise.all([
    readHostSettings(hostname),
    readGlobalFontStack(),
    readGlobalMonoFontStack(),
  ]);
  settings.fontFamily = serializeFontStack(globalFontStack);
  settings.monoFontFamily = serializeFontStack(globalMonoFontStack);
  const customFontNames = await injectCustomFonts();
  applySettings(settings, customFontNames);
}

loadAndApply();

chrome.storage.onChanged.addListener((changes, areaName) => {
  const hostname = window.location.hostname;

  if (
    areaName === "local" &&
    (changes[CUSTOM_FONTS_KEY] ||
      changes[CUSTOM_FONT_INDEX_KEY] ||
      Object.keys(changes).some((key) => key.startsWith(CUSTOM_FONT_CHUNK_PREFIX)))
  ) {
    loadAndApply();
    return;
  }

  if (areaName !== "local") {
    return;
  }

  const globalChange = changes[GLOBAL_ENABLED_KEY];
  const fontStackChange = changes[GLOBAL_FONT_STACK_KEY];
  const monoFontStackChange = changes[GLOBAL_MONO_FONT_STACK_KEY];

  if (globalChange || fontStackChange || monoFontStackChange) {
    if (globalChange?.newValue === false) {
      removeInjectedStyles();
      return;
    }

    loadAndApply();
    return;
  }

  const change = changes[hostname];

  if (!change) {
    return;
  }

  if (changes[GLOBAL_ENABLED_KEY]?.newValue === false) {
    removeInjectedStyles();
    return;
  }

  readGlobalEnabled().then((globalEnabled) => {
    if (!globalEnabled) {
      removeInjectedStyles();
      return;
    }

    loadAndApply();
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "STYLESHIFT_REINJECT") {
    loadAndApply();
  }
});
