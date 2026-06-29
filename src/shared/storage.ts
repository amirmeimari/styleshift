// Global and per-host settings persisted in chrome.storage.local.

import {
  AUTO_ENABLE_ALL_SITES_KEY,
  DEFAULT_SETTINGS,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
  isPreActivatedHost,
  type StyleShiftSettings,
  type StyleShiftStorage,
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
  return stored[GLOBAL_MONO_FONT_STACK_KEY] ?? ["MonoLisa"];
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

export async function readHostSettings(
  hostname: string,
): Promise<StyleShiftSettings> {
  const stored = (await chrome.storage.local.get(
    hostname,
  )) as StyleShiftStorage;
  const autoEnable = await readAutoEnableAllSites();
  const storedSettings = stored[hostname];
  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    fontEnabled:
      storedSettings?.fontEnabled ??
      (autoEnable || isPreActivatedHost(hostname)),
  };
}

export async function updateHostSettings(
  hostname: string,
  settings: StyleShiftSettings,
): Promise<void> {
  await chrome.storage.local.set({ [hostname]: settings });
}
