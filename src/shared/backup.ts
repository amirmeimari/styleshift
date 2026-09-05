// Export/import format for StyleShift's settings. Pure - no chrome.* access,
// so the whitelist-copy validation below is unit-testable without a storage
// stub and can never accidentally read or write real storage itself.
//
// The single most important rule here: a parsed backup is copied field by
// field into known-shape objects (sanitizeSettings, the globals allowlist in
// parseBackup) and never spread wholesale into anything that gets written to
// storage. A crafted "site" key of e.g. "__styleshift_enabled__" must never
// reach chrome.storage.local.set - that is the whole reason isHostSettingsKey
// exists and why every site key is checked against it before being trusted.

import { isLocaleCode, type LocaleCode } from "./i18n/locales";
import { isThemePref, type ThemePref } from "./theme";
import {
  DEFAULT_SETTINGS,
  isValidFontFormat,
  normalizeTypography,
  type CustomFont,
  type StyleShiftSettings,
  type TypographySettings,
} from "./style-core";

export const BACKUP_FORMAT = "styleshift-backup";
export const BACKUP_VERSION = 1;

export type BackupFont = CustomFont;

export type StyleShiftBackupGlobals = {
  enabled?: boolean;
  autoEnableAllSites?: boolean;
  fontStack?: string[];
  monoFontStack?: string[];
  typography?: TypographySettings;
  locale?: LocaleCode;
  theme?: ThemePref;
};

export type StyleShiftBackup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion?: string;
  globals: StyleShiftBackupGlobals;
  sites: Record<string, StyleShiftSettings>;
  /** Omitted entirely (not []) in settings-only exports. */
  fonts?: BackupFont[];
};

export type BuildBackupInput = {
  globals: StyleShiftBackupGlobals;
  sites: Record<string, StyleShiftSettings>;
  fonts?: BackupFont[];
  appVersion?: string;
  now?: Date;
};

export function buildBackup(input: BuildBackupInput): StyleShiftBackup {
  const backup: StyleShiftBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    globals: input.globals,
    sites: input.sites,
  };

  if (input.appVersion) {
    backup.appVersion = input.appVersion;
  }
  if (input.fonts) {
    backup.fonts = input.fonts;
  }

  return backup;
}

export function serializeBackup(backup: StyleShiftBackup): string {
  return JSON.stringify(backup, null, 2);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function backupFilename(now: Date = new Date()): string {
  return `styleshift-backup-${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}.json`;
}

// Every non-host storage key StyleShift writes is prefixed this way -
// GLOBAL_*, TYPOGRAPHY_KEY, LOCALE_STORAGE_KEY, THEME_STORAGE_KEY,
// AUTO_ENABLE_ALL_SITES_KEY, CUSTOM_FONT* (index and chunk keys alike).
// Anything else is a per-host settings record.
const RESERVED_KEY_PREFIX = "__styleshift";

export function isHostSettingsKey(key: string): boolean {
  return !key.startsWith(RESERVED_KEY_PREFIX);
}

const MAX_SITES = 5000;
const MAX_CSS_LENGTH = 100_000; // ~100 KB
const HOSTNAME_KEY_PATTERN = /^[a-z0-9][a-z0-9.\-_]{0,252}$/i;

function sanitizeStringField(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

// Matches the `!== false` convention already used throughout storage.ts:
// only an explicit boolean `false` flips the result away from the default -
// a truthy-looking string, a number, or an absent field all read as default.
function sanitizeBooleanField(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// The ONLY path a parsed "site" object takes on its way into storage. Every
// field is type-checked and defaulted individually - never `{...raw}`.
export function sanitizeSettings(raw: unknown): StyleShiftSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof StyleShiftSettings, unknown>
  >;

  return {
    fontFamily: sanitizeStringField(
      source.fontFamily,
      DEFAULT_SETTINGS.fontFamily,
      2000,
    ),
    monoFontFamily: sanitizeStringField(
      source.monoFontFamily,
      DEFAULT_SETTINGS.monoFontFamily,
      2000,
    ),
    fontEnabled: sanitizeBooleanField(
      source.fontEnabled,
      DEFAULT_SETTINGS.fontEnabled,
    ),
    cssEnabled: sanitizeBooleanField(
      source.cssEnabled,
      DEFAULT_SETTINGS.cssEnabled,
    ),
    customCSS: sanitizeStringField(
      source.customCSS,
      DEFAULT_SETTINGS.customCSS,
      MAX_CSS_LENGTH,
    ),
    includeSubdomains: sanitizeBooleanField(
      source.includeSubdomains,
      DEFAULT_SETTINGS.includeSubdomains,
    ),
  };
}

const BASE64_PATTERN = /^[A-Za-z0-9+/=]*$/;
const MAX_FONT_BYTES = 5 * 1024 * 1024; // ~5MB per font
const MAX_TOTAL_FONT_BYTES = 20 * 1024 * 1024; // ~20MB across the whole import

function sanitizeFonts(raw: unknown[]): {
  fonts: BackupFont[];
  dropped: number;
} {
  const fonts: BackupFont[] = [];
  let totalBytes = 0;
  let dropped = 0;

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      dropped++;
      continue;
    }

    const font = entry as Record<string, unknown>;
    const id = typeof font.id === "string" ? font.id : "";
    const name = typeof font.name === "string" ? font.name : "";
    const format =
      typeof font.format === "string" ? font.format.toLowerCase() : "";
    const mimeType = typeof font.mimeType === "string" ? font.mimeType : "";
    const data = typeof font.data === "string" ? font.data : "";

    if (
      !id ||
      !name ||
      !data ||
      !isValidFontFormat(format) ||
      !BASE64_PATTERN.test(data) ||
      !mimeType
    ) {
      dropped++;
      continue;
    }

    // Every 4 base64 characters encode 3 bytes.
    const bytes = Math.floor((data.length * 3) / 4);
    if (bytes > MAX_FONT_BYTES || totalBytes + bytes > MAX_TOTAL_FONT_BYTES) {
      dropped++;
      continue;
    }

    totalBytes += bytes;
    fonts.push({ id, name, format, mimeType, data });
  }

  return { fonts, dropped };
}

export type BackupParseResult =
  | { ok: true; backup: StyleShiftBackup; warnings: string[] }
  | {
      ok: false;
      error: "invalid-json" | "not-a-backup" | "unsupported-version";
    };

function sanitizeGlobals(raw: unknown): {
  globals: StyleShiftBackupGlobals;
  warnings: string[];
} {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const globals: StyleShiftBackupGlobals = {};
  const warnings: string[] = [];

  if (typeof source.enabled === "boolean") {
    globals.enabled = source.enabled;
  }
  if (typeof source.autoEnableAllSites === "boolean") {
    globals.autoEnableAllSites = source.autoEnableAllSites;
  }
  if (
    Array.isArray(source.fontStack) &&
    source.fontStack.every((f) => typeof f === "string")
  ) {
    globals.fontStack = source.fontStack as string[];
  } else if (source.fontStack !== undefined) {
    warnings.push("Global font stack was invalid and was dropped.");
  }
  if (
    Array.isArray(source.monoFontStack) &&
    source.monoFontStack.every((f) => typeof f === "string")
  ) {
    globals.monoFontStack = source.monoFontStack as string[];
  } else if (source.monoFontStack !== undefined) {
    warnings.push("Global mono font stack was invalid and was dropped.");
  }
  if (source.typography !== undefined) {
    globals.typography = normalizeTypography(source.typography);
  }
  if (isLocaleCode(source.locale)) {
    globals.locale = source.locale;
  } else if (source.locale !== undefined) {
    warnings.push("Saved language was invalid and was dropped.");
  }
  if (isThemePref(source.theme)) {
    globals.theme = source.theme;
  } else if (source.theme !== undefined) {
    warnings.push("Saved theme was invalid and was dropped.");
  }

  return { globals, warnings };
}

export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid-json" };
  }

  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "not-a-backup" };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return { ok: false, error: "not-a-backup" };
  }
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) {
    return { ok: false, error: "unsupported-version" };
  }

  const warnings: string[] = [];

  const { globals, warnings: globalWarnings } = sanitizeGlobals(obj.globals);
  warnings.push(...globalWarnings);

  const rawSites = (
    obj.sites && typeof obj.sites === "object" ? obj.sites : {}
  ) as Record<string, unknown>;
  const sites: Record<string, StyleShiftSettings> = {};
  let acceptedSites = 0;
  let droppedSites = 0;

  for (const [key, value] of Object.entries(rawSites)) {
    if (acceptedSites >= MAX_SITES) {
      droppedSites++;
      continue;
    }
    if (!isHostSettingsKey(key) || !HOSTNAME_KEY_PATTERN.test(key)) {
      droppedSites++;
      continue;
    }
    sites[key] = sanitizeSettings(value);
    acceptedSites++;
  }

  if (droppedSites > 0) {
    warnings.push(
      `${droppedSites} site record(s) had an invalid key or exceeded the ${MAX_SITES}-site limit and were dropped.`,
    );
  }

  let fonts: BackupFont[] | undefined;
  if (Array.isArray(obj.fonts)) {
    const sanitized = sanitizeFonts(obj.fonts);
    fonts = sanitized.fonts;
    if (sanitized.dropped > 0) {
      warnings.push(
        `${sanitized.dropped} font(s) were invalid or exceeded the size limit and were dropped.`,
      );
    }
  }

  const backup: StyleShiftBackup = {
    format: BACKUP_FORMAT,
    version: obj.version,
    exportedAt:
      typeof obj.exportedAt === "string"
        ? obj.exportedAt
        : new Date().toISOString(),
    globals,
    sites,
  };
  if (typeof obj.appVersion === "string") {
    backup.appVersion = obj.appVersion;
  }
  if (fonts) {
    backup.fonts = fonts;
  }

  return { ok: true, backup, warnings };
}
