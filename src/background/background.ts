import type { ReinjectMessage } from "@/shared/messages";

const REINJECT_MESSAGE: ReinjectMessage = { type: "STYLESHIFT_REINJECT" };

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  chrome.tabs.sendMessage(tabId, REINJECT_MESSAGE).catch(() => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  });
});
