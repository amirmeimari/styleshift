// Tab helpers used by extension pages (popup, editors). The content script is
// the single place that reads settings and applies styles to a page; these
// helpers only locate tabs and nudge the content script to re-apply. Cross-tab
// updates are handled automatically by the content script's
// `chrome.storage.onChanged` listener, so there is no need to re-implement the
// styling logic here.

import { isInjectableUrl } from "./style-core";
import type { ReinjectMessage } from "./messages";

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
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

const REINJECT_MESSAGE: ReinjectMessage = { type: "STYLESHIFT_REINJECT" };

// Ask the content script in `tabId` to re-read settings and re-apply. If the
// content script is not present yet, inject it; it will apply on load.
export async function requestReinject(
  tabId: number | undefined,
): Promise<void> {
  if (!tabId) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, REINJECT_MESSAGE);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    } catch {
      // Page may not allow injection (e.g. chrome:// or the web store) - ignore.
    }
  }
}
