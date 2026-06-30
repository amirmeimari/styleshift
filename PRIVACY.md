# StyleShift Privacy Policy

_Last updated: 2026-06-30_

StyleShift is a browser extension that injects local fonts and custom CSS into
web pages. This policy explains what data the extension handles.

## What StyleShift stores

All data is stored **locally on your device** using the browser's extension
storage (`chrome.storage.local`). StyleShift does not run any servers and does
not have a backend that receives your data.

The extension stores:

- **Your per-site and global preferences** — which font stacks are active,
  whether styling is enabled, and any custom CSS you write. Hostnames are stored
  only as the key for your own settings; they are never transmitted anywhere.
- **Fonts you upload or import** — stored as font data on your device so they can
  be re-applied on future visits.
- **An optional Google Fonts API key** — only if you choose to enter one in
  Settings, stored locally and used solely to talk to Google's Fonts API.

## Network requests

StyleShift makes network requests **only when you explicitly import a Google
Font**:

- It contacts the Google Fonts API (`googleapis.com`) using the API key you
  provided to list and download the font you selected.
- The downloaded font is then stored locally and injected like any other local
  font. No styling at page-render time requires a network request.

StyleShift does **not**:

- Track your browsing history.
- Collect analytics or telemetry.
- Send your settings, custom CSS, the contents of pages you visit, or any
  personally identifiable information to the developer or any third party.

## Permissions

- **Host access (`<all_urls>`)** — required to inject your chosen fonts and CSS
  into the pages you enable. Styling is applied locally in your browser.
- **`storage` / `unlimitedStorage`** — to save your settings and uploaded fonts
  locally (fonts can be large, hence unlimited storage).
- **`scripting` / `activeTab`** — to (re)apply your styles to the current tab.

## Contact

Questions about this policy? Email **amirmeimari@gmail.com**.
