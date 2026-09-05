import {
  DEFAULT_SETTINGS,
  TYPOGRAPHY_KEY,
  isInjectableUrl,
  normalizeTypography,
} from "@/shared/style-core";
import { applyMinimumFontSize } from "@/shared/min-font-size";
import { resolveHostSettings, updateHostSettings } from "@/shared/storage";
import { requestReinject } from "@/shared/tabs";
import type { ReinjectMessage } from "@/shared/messages";

const REINJECT_MESSAGE: ReinjectMessage = { type: "STYLESHIFT_REINJECT" };

// Storage keys written by features that no longer exist. They are removed on
// install/update so an upgrade does not leave orphaned data behind - notably
// the Google Fonts API key, which users of older versions may have entered
// before the Google Fonts integration was removed.
const RETIRED_STORAGE_KEYS = ["__styleshift_google_api_key__"];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(RETIRED_STORAGE_KEYS).catch(() => {
    // Nothing to clean up, or storage is unavailable - not worth surfacing.
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Restricted pages (chrome://, the extension's own pages, the Web Store,
  // etc.) can't be scripted - skip them instead of letting the rejection
  // surface as an uncaught error in the extension's error log.
  if (changeInfo.status !== "complete" || !isInjectableUrl(tab.url)) {
    return;
  }

  chrome.tabs.sendMessage(tabId, REINJECT_MESSAGE).catch(() => {
    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ["content.js"],
      })
      .catch(() => {
        // Tab may have closed or navigated away before injection ran - ignore.
      });
  });
});

// Minimum font size is a browser-global Chrome preference (chrome.fontSettings),
// not per-page CSS, so it is applied here rather than in content.ts - and only
// needs the change path, since the preference itself persists across service
// worker restarts.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[TYPOGRAPHY_KEY]) {
    return;
  }

  const typography = normalizeTypography(changes[TYPOGRAPHY_KEY].newValue);
  applyMinimumFontSize(typography.minFontSize).catch(() => {
    // chrome.fontSettings unavailable (e.g. policy-restricted) - nothing to
    // surface here; the pref just doesn't apply.
  });
});

// Alt+Shift+S (see manifest "commands") toggles fonts for the active tab's
// site without opening the popup - the same operation as the popup's own
// font on/off switch, just reachable without a click.
async function handleToggleFontCommand(): Promise<void> {
  // The service worker has no notion of a "current" window - lastFocusedWindow
  // is the form extensions use here instead of the currentWindow that popup/
  // options pages (which do run in a window) use in tabs.ts's getActiveTab.
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (!tab?.id || !isInjectableUrl(tab.url)) {
    return;
  }

  const hostname = new URL(tab.url!).hostname;

  // Same base-settings rule as the popup's saveAndInject: when hostname has
  // no own record (it's inheriting from an ancestor, or has nothing), base on
  // DEFAULT_SETTINGS rather than the resolved ancestor settings - otherwise
  // toggling the shortcut on a subdomain would freeze a permanent copy of the
  // ancestor's customCSS/fontFamily onto it.
  const resolved = await resolveHostSettings(hostname);
  const base =
    resolved.sourceHost === hostname
      ? resolved.settings
      : { ...DEFAULT_SETTINGS, fontEnabled: resolved.settings.fontEnabled };
  await updateHostSettings(hostname, {
    ...base,
    fontEnabled: !base.fontEnabled,
  });
  await requestReinject(tab.id);
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-font") {
    return;
  }

  handleToggleFontCommand().catch(() => {
    // Storage/tab access can fail (context invalidated, quota, policy) - the
    // shortcut just silently no-ops rather than surfacing to the user.
  });
});
