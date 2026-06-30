import { isInjectableUrl } from "@/shared/style-core";
import type { ReinjectMessage } from "@/shared/messages";

const REINJECT_MESSAGE: ReinjectMessage = { type: "STYLESHIFT_REINJECT" };

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
