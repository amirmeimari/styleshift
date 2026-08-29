# StyleShift Privacy Policy

_Last updated: 2026-08-29_

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
- **Fonts you upload** — stored as font data on your device so they can be
  re-applied on future visits. Uploaded fonts never leave your device.

## Network requests

StyleShift does not fetch fonts, stylesheets, or configuration from any remote
server. Every font it can apply is either bundled with the extension or one you
uploaded yourself, and both are injected from local data — styling a page never
requires a network request.

The one exception is cosmetic: the site shortcut grid in the popup loads its
brand icons from the public CDN `cdn.jsdelivr.net`. This request contains no
information about you, your settings, or the pages you visit — it is a plain
request for a static icon file, and it happens only while the popup is open. If
an icon fails to load, StyleShift falls back to a text label.

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
