# Changelog

## 1.2.0

- Dark mode: follows the OS by default, with a Light/Dark/System override in Settings.
- Typography controls: line height, letter spacing, font weight, and a minimum font size.
- Per-site settings now inherit across subdomains, with an opt-out per site.
- Settings export/import and a site manager, on a new options page.
- Preset icons are now bundled with the extension (no more CDN request).
- Global CSS (applies everywhere) and a keyboard shortcut to toggle fonts.
- CSS editor uses the bundled JetBrains Mono font.
- Various bug fixes: stale-tab CSS injection, subdomain/main-domain edge cases.

## 1.1.0

- Replaced the plain textarea with a CodeMirror-based CSS editor.
- Dropped the Google Fonts API dependency.

## 1.0.0

- Initial release: per-site font override and custom CSS, bundled + Google fonts,
  5-locale UI (with RTL support), auto-enable for all sites, and the Fabric UI design.
