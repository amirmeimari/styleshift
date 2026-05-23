chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  chrome.tabs
    .sendMessage(tabId, { type: "STYLESHIFT_REINJECT" })
    .catch(() => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    });
});
