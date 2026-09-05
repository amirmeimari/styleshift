// Global and per-host settings persisted in chrome.storage.local.

import { DEFAULT_MONO_FONT } from "./builtin-fonts";
import {
  AUTO_ENABLE_ALL_SITES_KEY,
  DEFAULT_SETTINGS,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
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

export async function readGlobalFontStack(): Promise<string[]> {
  const stored = (await chrome.storage.local.get(
    GLOBAL_FONT_STACK_KEY,
  )) as Record<string, string[] | undefined>;
  return stored[GLOBAL_FONT_STACK_KEY] ?? [];
}

export async function updateGlobalFontStack(
  fontStack: string[],
): Promise<void> {
  await chrome.storage.local.set({ [GLOBAL_FONT_STACK_KEY]: fontStack });
}

export async function readGlobalMonoFontStack(): Promise<string[]> {
  const stored = (await chrome.storage.local.get(
    GLOBAL_MONO_FONT_STACK_KEY,
  )) as Record<string, string[] | undefined>;
  return stored[GLOBAL_MONO_FONT_STACK_KEY] ?? [DEFAULT_MONO_FONT];
}

export async function updateGlobalMonoFontStack(
  fontStack: string[],
): Promise<void> {
  await chrome.storage.local.set({ [GLOBAL_MONO_FONT_STACK_KEY]: fontStack });
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

export async function updateTypography(
  patch: Partial<TypographySettings>,
): Promise<TypographySettings> {
  const current = await readTypography();
  const next = normalizeTypography({ ...current, ...patch });
  await chrome.storage.local.set({ [TYPOGRAPHY_KEY]: next });
  return next;
}
