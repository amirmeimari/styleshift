// Global and per-host settings persisted in chrome.storage.local.

import {
  BUILTIN_MONO_FONT_NAMES,
  BUILTIN_SANS_FONT_NAMES,
  DEFAULT_MONO_FONT,
} from "./builtin-fonts";
import { distinctFontNames } from "./font-stack";
import {
  AUTO_ENABLE_ALL_SITES_KEY,
  DEFAULT_SETTINGS,
  GLOBAL_CSS_KEY,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
  SAVED_TEXT_FONT_NAMES_KEY,
  SAVED_CODE_FONT_NAMES_KEY,
  TYPOGRAPHY_KEY,
  hostSettingsCandidates,
  isPreActivatedHost,
  normalizeTypography,
  type StyleShiftSettings,
  type StyleShiftStorage,
  type TypographySettings,
} from "./style-core";

export async function readGlobalEnabled(): Promise<boolean> {
  const stored = (await chrome.storage.local.get(GLOBAL_ENABLED_KEY)) as Record<
    string,
    boolean | undefined
  >;
  return stored[GLOBAL_ENABLED_KEY] ?? true;
}

export async function updateGlobalEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: enabled });
}

// Shared readers define selection for both UI and page injection. Missing
// keys use the defaults below; explicit [] disables that override. Legacy
// host font fields are retained as data, never promoted into shared stacks.
export type StoredFontStack = { value: string[]; exists: boolean };

export async function readGlobalFontStackEntry(): Promise<StoredFontStack> {
  const stored = (await chrome.storage.local.get(
    GLOBAL_FONT_STACK_KEY,
  )) as Record<string, string[] | undefined>;
  return {
    value: stored[GLOBAL_FONT_STACK_KEY] ?? [],
    exists: Object.prototype.hasOwnProperty.call(stored, GLOBAL_FONT_STACK_KEY),
  };
}

export async function readGlobalFontStack(): Promise<string[]> {
  return (await readGlobalFontStackEntry()).value;
}

export async function readSavedFontNames(): Promise<{
  text: string[];
  code: string[];
}> {
  // The old shared list did not record which picker added a name.
  const stored = (await chrome.storage.local.get([
    SAVED_TEXT_FONT_NAMES_KEY,
    SAVED_CODE_FONT_NAMES_KEY,
  ])) as Record<string, string[] | undefined>;
  return {
    text: stored[SAVED_TEXT_FONT_NAMES_KEY] ?? [],
    code: stored[SAVED_CODE_FONT_NAMES_KEY] ?? [],
  };
}

let fontStackWriteQueue = Promise.resolve<string[]>([]);

function saveFontSelection(
  key: typeof GLOBAL_FONT_STACK_KEY | typeof GLOBAL_MONO_FONT_STACK_KEY,
  savedKey: typeof SAVED_TEXT_FONT_NAMES_KEY | typeof SAVED_CODE_FONT_NAMES_KEY,
  next: string[],
  listedFonts: readonly string[],
): Promise<string[]> {
  fontStackWriteQueue = fontStackWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const stored = (await chrome.storage.local.get([
        key,
        savedKey,
      ])) as Record<string, string[] | undefined>;
      const saved = stored[savedKey] ?? [];
      // Preserve the previous selection even when it predates this history.
      const localNames = distinctFontNames(
        [...(stored[key] ?? []), ...next],
        listedFonts,
      );
      const nextSaved = distinctFontNames([...saved, ...localNames]);
      await chrome.storage.local.set({
        [key]: next,
        ...(nextSaved.length ? { [savedKey]: nextSaved } : {}),
      });
      return nextSaved;
    });
  return fontStackWriteQueue;
}

export async function updateGlobalFontStack(
  fontStack: string[],
  uploadedFontNames: string[] = [],
): Promise<string[]> {
  return saveFontSelection(
    GLOBAL_FONT_STACK_KEY,
    SAVED_TEXT_FONT_NAMES_KEY,
    fontStack,
    [...BUILTIN_SANS_FONT_NAMES, ...uploadedFontNames],
  );
}

export async function readGlobalMonoFontStackEntry(): Promise<StoredFontStack> {
  const stored = (await chrome.storage.local.get(
    GLOBAL_MONO_FONT_STACK_KEY,
  )) as Record<string, string[] | undefined>;
  return {
    value: stored[GLOBAL_MONO_FONT_STACK_KEY] ?? [DEFAULT_MONO_FONT],
    exists: Object.prototype.hasOwnProperty.call(
      stored,
      GLOBAL_MONO_FONT_STACK_KEY,
    ),
  };
}

export async function readGlobalMonoFontStack(): Promise<string[]> {
  return (await readGlobalMonoFontStackEntry()).value;
}

export async function updateGlobalMonoFontStack(
  fontStack: string[],
  uploadedFontNames: string[] = [],
): Promise<string[]> {
  return saveFontSelection(
    GLOBAL_MONO_FONT_STACK_KEY,
    SAVED_CODE_FONT_NAMES_KEY,
    fontStack,
    [...BUILTIN_MONO_FONT_NAMES, ...uploadedFontNames],
  );
}

export async function readGlobalCSS(): Promise<string> {
  const stored = (await chrome.storage.local.get(GLOBAL_CSS_KEY)) as Record<
    string,
    string | undefined
  >;
  return stored[GLOBAL_CSS_KEY] ?? "";
}

export async function updateGlobalCSS(css: string): Promise<void> {
  await chrome.storage.local.set({ [GLOBAL_CSS_KEY]: css });
}

export async function readAutoEnableAllSites(): Promise<boolean> {
  const stored = (await chrome.storage.local.get(
    AUTO_ENABLE_ALL_SITES_KEY,
  )) as Record<string, boolean | undefined>;
  return stored[AUTO_ENABLE_ALL_SITES_KEY] ?? false;
}

export async function updateAutoEnableAllSites(
  enabled: boolean,
): Promise<void> {
  await chrome.storage.local.set({ [AUTO_ENABLE_ALL_SITES_KEY]: enabled });
}

export type ResolvedHostSettings = {
  settings: StyleShiftSettings;
  /** Which storage key the settings came from; null when nothing matched. */
  sourceHost: string | null;
  /** True when sourceHost is an ancestor of the requested hostname. */
  inherited: boolean;
};

// Resolution order: (1) the hostname's own record always wins; (2) else walk
// the candidate chain and let the nearest ancestor that has a record decide -
// unless that record opted out via `includeSubdomains: false`, in which case
// resolution stops there rather than reaching past it to a broader ancestor;
// (3) else DEFAULT_SETTINGS, with fontEnabled resolved from
// autoEnable/isPreActivatedHost using the *original* hostname in every case,
// never an ancestor's.
export async function resolveHostSettings(
  hostname: string,
): Promise<ResolvedHostSettings> {
  const candidates = hostSettingsCandidates(hostname);
  const autoEnable = await readAutoEnableAllSites();
  const fallbackFontEnabled = autoEnable || isPreActivatedHost(hostname);

  if (candidates.length === 0) {
    return {
      settings: { ...DEFAULT_SETTINGS, fontEnabled: fallbackFontEnabled },
      sourceHost: null,
      inherited: false,
    };
  }

  const stored = (await chrome.storage.local.get(
    candidates,
  )) as StyleShiftStorage;
  const [primary, ...ancestors] = candidates;

  const own = stored[primary];
  if (own) {
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...own,
        fontEnabled: own.fontEnabled ?? fallbackFontEnabled,
      },
      sourceHost: primary,
      inherited: false,
    };
  }

  for (const ancestor of ancestors) {
    const record = stored[ancestor];
    if (!record) {
      continue;
    }
    if (record.includeSubdomains === false) {
      break;
    }
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...record,
        fontEnabled: record.fontEnabled ?? fallbackFontEnabled,
      },
      sourceHost: ancestor,
      inherited: true,
    };
  }

  return {
    settings: { ...DEFAULT_SETTINGS, fontEnabled: fallbackFontEnabled },
    sourceHost: null,
    inherited: false,
  };
}

export async function readHostSettings(
  hostname: string,
): Promise<StyleShiftSettings> {
  return (await resolveHostSettings(hostname)).settings;
}

export async function updateHostSettings(
  hostname: string,
  settings: StyleShiftSettings,
): Promise<void> {
  await chrome.storage.local.set({ [hostname]: settings });
}

// Un-customize: drop this host's own record so it inherits again.
export async function clearHostSettings(hostname: string): Promise<void> {
  await chrome.storage.local.remove(hostname);
}

export async function readTypography(): Promise<TypographySettings> {
  const stored = (await chrome.storage.local.get(TYPOGRAPHY_KEY)) as Record<
    string,
    unknown
  >;
  return normalizeTypography(stored[TYPOGRAPHY_KEY]);
}

// Serialize this page's slider writes and read storage inside each queued
// operation. A cached result would restore stale fields after a backup import
// or a change from another extension page.
let typographyWriteQueue: Promise<TypographySettings> | null = null;

export async function updateTypography(
  patch: Partial<TypographySettings>,
): Promise<TypographySettings> {
  typographyWriteQueue = (typographyWriteQueue ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const current = await readTypography();
      const next = normalizeTypography({ ...current, ...patch });
      await chrome.storage.local.set({ [TYPOGRAPHY_KEY]: next });
      return next;
    });
  return typographyWriteQueue;
}
