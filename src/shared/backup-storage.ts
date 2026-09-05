// The only file that touches chrome.storage for export/import. All shape
// validation lives in backup.ts (pure); this module just collects the
// current state into that shape, and writes a validated backup back out.

import {
  buildBackup,
  isHostSettingsKey,
  type StyleShiftBackup,
  type StyleShiftBackupGlobals,
} from "./backup";
import {
  AUTO_ENABLE_ALL_SITES_KEY,
  GLOBAL_CSS_KEY,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
  TYPOGRAPHY_KEY,
  normalizeTypography,
  type StyleShiftSettings,
} from "./style-core";
import { readCustomFonts, updateCustomFont } from "./custom-fonts";
import {
  readAutoEnableAllSites,
  readGlobalCSS,
  readGlobalEnabled,
  readGlobalFontStack,
  readGlobalMonoFontStack,
  readTypography,
} from "./storage";
import { LOCALE_STORAGE_KEY, isLocaleCode } from "./i18n/locales";
import { THEME_STORAGE_KEY, isThemePref } from "./theme";

export async function collectBackup(
  includeFonts: boolean,
): Promise<StyleShiftBackup> {
  const [
    all,
    enabled,
    autoEnableAllSites,
    fontStack,
    monoFontStack,
    typography,
    globalCSS,
    customFonts,
  ] = await Promise.all([
    chrome.storage.local.get(null) as Promise<Record<string, unknown>>,
    readGlobalEnabled(),
    readAutoEnableAllSites(),
    readGlobalFontStack(),
    readGlobalMonoFontStack(),
    readTypography(),
    readGlobalCSS(),
    includeFonts ? readCustomFonts() : Promise.resolve({}),
  ]);

  const sites: Record<string, StyleShiftSettings> = {};
  for (const [key, value] of Object.entries(all)) {
    if (isHostSettingsKey(key) && value && typeof value === "object") {
      sites[key] = value as StyleShiftSettings;
    }
  }

  const globals: StyleShiftBackupGlobals = {
    enabled,
    autoEnableAllSites,
    fontStack,
    monoFontStack,
    typography,
  };

  // Unlike fontStack/typography (recoverable preferences safe to always
  // round-trip), global CSS is user-authored content - only include it when
  // non-empty, so a merge-mode import from a profile that never set any
  // doesn't silently wipe the importing profile's global CSS. GLOBAL_KEY_MAP
  // writes any field present here, in every mode.
  if (globalCSS) {
    globals.globalCSS = globalCSS;
  }

  if (isLocaleCode(all[LOCALE_STORAGE_KEY])) {
    globals.locale = all[LOCALE_STORAGE_KEY];
  }
  if (isThemePref(all[THEME_STORAGE_KEY])) {
    globals.theme = all[THEME_STORAGE_KEY];
  }

  let appVersion: string | undefined;
  try {
    appVersion = chrome.runtime.getManifest().version;
  } catch {
    appVersion = undefined;
  }

  return buildBackup({
    globals,
    sites,
    fonts: includeFonts ? Object.values(customFonts) : undefined,
    appVersion,
  });
}

export type BackupApplyReport = {
  sitesWritten: number;
  fontsWritten: number;
  globalsWritten: string[];
};

const GLOBAL_KEY_MAP: Record<keyof StyleShiftBackupGlobals, string> = {
  enabled: GLOBAL_ENABLED_KEY,
  autoEnableAllSites: AUTO_ENABLE_ALL_SITES_KEY,
  fontStack: GLOBAL_FONT_STACK_KEY,
  monoFontStack: GLOBAL_MONO_FONT_STACK_KEY,
  typography: TYPOGRAPHY_KEY,
  locale: LOCALE_STORAGE_KEY,
  theme: THEME_STORAGE_KEY,
  globalCSS: GLOBAL_CSS_KEY,
};

// Merge overwrites only the keys present in the backup; hosts/globals absent
// from the file are left untouched. Replace makes storage match the backup
// exactly: every StyleShift-owned key present before the import but absent
// from the backup - including theme/language if the file predates them, and
// every site not listed - is removed, not just left alone.
export async function applyBackup(
  backup: StyleShiftBackup,
  mode: "merge" | "replace",
): Promise<BackupApplyReport> {
  const payload: Record<string, unknown> = {};
  const globalsWritten: string[] = [];

  for (const [field, key] of Object.entries(GLOBAL_KEY_MAP) as [
    keyof StyleShiftBackupGlobals,
    string,
  ][]) {
    const value = backup.globals[field];
    if (value === undefined) {
      continue;
    }
    payload[key] = field === "typography" ? normalizeTypography(value) : value;
    globalsWritten.push(field);
  }

  for (const [host, settings] of Object.entries(backup.sites)) {
    payload[host] = settings;
  }

  if (mode === "replace") {
    // Snapshot every owned key before writing anything, so the cleanup pass
    // below can tell "existed before, absent from the backup" apart from
    // "just written by this import" - including font index/chunk keys,
    // which are cleaned up implicitly here and rebuilt by the font pass.
    const before = (await chrome.storage.local.get(null)) as Record<
      string,
      unknown
    >;
    const ownedBefore = Object.keys(before).filter(
      (key) => key.startsWith("__styleshift") || isHostSettingsKey(key),
    );

    // Write first, remove second: a crash between the two steps leaves the
    // user with the new settings rather than with nothing at all.
    await chrome.storage.local.set(payload);
    const stale = ownedBefore.filter((key) => !(key in payload));
    if (stale.length > 0) {
      await chrome.storage.local.remove(stale);
    }
  } else {
    await chrome.storage.local.set(payload);
  }

  // Reuses updateCustomFont's existing chunking/index-merge logic, which is
  // exactly what "merge" needs (it preserves fonts the backup doesn't
  // mention). For "replace", the stale-key cleanup above already dropped the
  // previous index and every chunk, so this rebuilds from a clean slate.
  let fontsWritten = 0;
  for (const font of backup.fonts ?? []) {
    await updateCustomFont(font);
    fontsWritten++;
  }

  return {
    sitesWritten: Object.keys(backup.sites).length,
    fontsWritten,
    globalsWritten,
  };
}
