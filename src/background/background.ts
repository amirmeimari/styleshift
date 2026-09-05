import {
  TYPOGRAPHY_KEY,
  isInjectableUrl,
  normalizeTypography,
} from "@/shared/style-core";
import { applyMinimumFontSize } from "@/shared/min-font-size";
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
    // Permission not granted, or chrome.fontSettings unavailable - the
    // options page surfaces the permission state; nothing to do here.
  });
});
