Build a Chrome Extension called "PageCraft" using React + Vite + shadcn/ui (no customizations)
that lets users inject a custom font and custom CSS into any webpage they visit.

## Tech Stack

- React + TypeScript + Vite
- shadcn/ui (default config, no theme customization)
- Tailwind CSS (dark mode via `class` strategy)
- Chrome Extension Manifest V3
- Nunito font (from Google Fonts) for all extension UI

## Core Features

### 1. Font Injector

- A text input where the user types font family names in CSS format (e.g., 'Roboto', 'Nunito')
- A checkbox labeled "Apply font to this page"
- When checked: inject the font via Google Fonts @import and apply it as font-family to `*` selector on the current tab
- When unchecked: remove the injected font style
- Settings are saved per hostname using `chrome.storage.local`

### 2. CSS Injector

- A textarea where the user writes raw CSS
- An "Apply CSS" button that injects the CSS into the current tab
- A "Remove CSS" button that removes the previously injected CSS
- CSS is saved per hostname using `chrome.storage.local`
- CSS is auto-re-injected on page load/navigation (via content script)

## Extension Architecture

- `manifest.json` — Manifest V3
- `src/popup/` — React popup UI (font input + CSS textarea)
- `src/content/content.ts` — Content script: reads from storage and applies font + CSS on load
- `src/background/background.ts` — Service worker: listens for tab updates and triggers re-injection
- Permissions needed: `activeTab`, `scripting`, `storage`, `tabs`
- Host permission: `<all_urls>`

## UI Requirements

- Dark mode only (add `dark` class to `<html>`)
- Popup width: 380px, no fixed height (auto)
- Nunito font loaded from Google Fonts in `popup.html`
- Use shadcn components: Card, Input, Textarea, Button, Checkbox, Label, Separator
- Layout: two sections separated by a Separator — "Font" section on top, "CSS" section below
- Each section has a section title in small uppercase muted text

## Storage Schema (per hostname)

```json
{
  "hostname.com": {
    "fontFamily": "'Roboto', sans-serif",
    "fontEnabled": true,
    "customCSS": "body { background: red; }"
  }
}
```

## Build

- Output to `dist/` folder
- `vite.config.ts` must handle multiple entry points (popup, content, background)
- After build, `dist/` folder should be directly loadable in chrome://extensions

Do NOT use any API calls, backend, or external services beyond Google Fonts.

```

---

## 📋 Step-by-Step Plan for Cursor Agent

### Phase 1 — Project Scaffold

**1.1 Init project**
```

npm create vite@latest pagecraft -- --template react-ts
cd pagecraft
npm install

```
- ✅ Verify: `npm run dev` runs without errors

**1.2 Install dependencies**
```

npm install -D tailwindcss postcss autoprefixer
npm install clsx tailwind-merge lucide-react
npx tailwindcss init -p
npx shadcn@latest init

```
- When shadcn asks: pick **Default** style, **Zinc** base color, **CSS variables: yes**
- ✅ Verify: `components.json` exists at root

**1.3 Add shadcn components**
```

npx shadcn@latest add card input textarea button checkbox label separator

````
- ✅ Verify: all components exist under `src/components/ui/`

**1.4 Configure Tailwind dark mode**
- In `tailwind.config.ts`: set `darkMode: 'class'`
- ✅ Verify: config has `darkMode: 'class'`

---

### Phase 2 — Manifest & Extension Config

**2.1 Create `public/manifest.json`**
```json
{
  "manifest_version": 3,
  "name": "PageCraft",
  "version": "1.0.0",
  "description": "Inject custom fonts and CSS into any webpage",
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}
````

- ✅ Verify: JSON is valid

**2.2 Create icon files**

- Add 16x16, 48x48, 128x128 PNG icons to `public/icons/`
- Use a simple "P" letter or paintbrush SVG converted to PNG
- ✅ Verify: files exist at correct paths

---

### Phase 3 — Vite Config for Multi-Entry Build

**3.1 Update `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        content: resolve(__dirname, "src/content/content.ts"),
        background: resolve(__dirname, "src/background/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

- ✅ Verify: `npm run build` produces `dist/popup.js`, `dist/content.js`, `dist/background.js`

**3.2 Create `popup.html` at root**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PageCraft</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      * {
        font-family: "Nunito", sans-serif !important;
      }
      body {
        width: 380px;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- ✅ Verify: popup.html references correct script entry

---

### Phase 4 — Content Script

**4.1 Create `src/content/content.ts`**

Logic:

1. Get current `hostname` from `window.location.hostname`
2. Read `chrome.storage.local.get(hostname)`
3. If `fontEnabled` is true and `fontFamily` is set:
   - Create a `<style id="pagecraft-font">` tag with `@import` from Google Fonts and `* { font-family: ... }`
   - Append to `<head>`
4. If `customCSS` is set:
   - Create a `<style id="pagecraft-css">` tag with the raw CSS
   - Append to `<head>`
5. Listen for `chrome.storage.onChanged` to reactively update without page reload

- ✅ Verify: after build, `dist/content.js` exists and has no import errors

**4.2 Helper: build Google Fonts URL from font name**

```ts
function buildGoogleFontsUrl(fontFamily: string): string {
  // Extract font name: 'Roboto' -> Roboto
  const name = fontFamily.replace(/['"]/g, "").split(",")[0].trim();
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;700&display=swap`;
}
```

- ✅ Verify: `buildGoogleFontsUrl("'Roboto', sans-serif")` returns correct Google Fonts URL

---

### Phase 5 — Background Service Worker

**5.1 Create `src/background/background.ts`**

Logic:

- Listen to `chrome.tabs.onUpdated` — when `status === 'complete'`, do nothing (content script handles it)
- This file exists mainly as a placeholder for future use and to satisfy MV3 requirements
- Optionally: handle `chrome.runtime.onInstalled` to set default storage

- ✅ Verify: background.ts compiles cleanly

---

### Phase 6 — Popup UI

**6.1 Create `src/popup/Popup.tsx`**

Structure:

```
<Card>
  <CardContent>
    <p class="section-label">FONT</p>
    <Input placeholder="'Roboto', sans-serif" />
    <Checkbox id="font-enable" />
    <Label htmlFor="font-enable">Apply font to this page</Label>

    <Separator />

    <p class="section-label">CUSTOM CSS</p>
    <Textarea placeholder="body { background: #000; }" rows={8} />
    <div class="flex gap-2">
      <Button>Apply CSS</Button>
      <Button variant="outline">Remove</Button>
    </div>
  </CardContent>
</Card>
```

State logic in `Popup.tsx`:

1. On mount: `chrome.tabs.query({active: true, currentWindow: true})` → get hostname
2. Load saved settings from `chrome.storage.local.get(hostname)`
3. Populate `fontFamily`, `fontEnabled`, `customCSS` state
4. On checkbox change: save to storage immediately → content script reacts via `onChanged`
5. On font input blur/change with checkbox checked: save + re-trigger injection
6. "Apply CSS": save CSS to storage → send `chrome.scripting.executeScript` to re-run injection
7. "Remove CSS": save empty CSS → clear `pagecraft-css` style tag via scripting

- ✅ Verify: UI renders correctly, all shadcn components visible
- ✅ Verify: dark mode active (zinc-900 background)
- ✅ Verify: Nunito font loads in popup

---

### Phase 7 — Storage & Injection Helpers

**7.1 Create `src/lib/storage.ts`**

```ts
export type SiteSettings = {
  fontFamily: string
  fontEnabled: boolean
  customCSS: string
}

export async function getSiteSettings(hostname: string): Promise<SiteSettings> { ... }
export async function setSiteSettings(hostname: string, settings: Partial<SiteSettings>): Promise<void> { ... }
```

**7.2 Create `src/lib/inject.ts`**

- `injectFont(fontFamily: string)` — builds style tag
- `removeFont()` — removes `#pagecraft-font`
- `injectCSS(css: string)` — builds style tag
- `removeCSS()` — removes `#pagecraft-css`

- ✅ Verify: helpers are used consistently in both content script and popup scripting calls

---

### Phase 8 — Build & Local Testing

**8.1 Build**

```
npm run build
```

- ✅ Verify: `dist/` has `popup.html`, `popup.js`, `content.js`, `background.js`, `manifest.json`, `icons/`

**8.2 Load in Chrome**

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/` folder
4. ✅ Verify: extension appears with correct name and icon

**8.3 Test Checklist**

- [ ] Open `https://example.com` → click extension icon → popup opens
- [ ] Type `'Roboto', sans-serif` in font input → check the checkbox → page font changes
- [ ] Uncheck checkbox → font reverts
- [ ] Reload page → font is still applied (content script re-injects from storage)
- [ ] Navigate to a different site → settings are blank (per-hostname isolation works)
- [ ] Go back to `example.com` → previous settings are restored
- [ ] Type CSS in textarea → click "Apply CSS" → styles apply on page
- [ ] Click "Remove CSS" → styles removed
- [ ] Reload page → CSS re-applies from storage
- [ ] Test on `https://github.com` and `https://google.com` independently

---

### Phase 9 — Chrome Web Store Prep

**9.1 Create store assets**

- 440x280 screenshot (at least 1, up to 5)
- 1280x800 or 640x400 promotional image
- Description text (short: 132 chars max, long: 16k chars max)

**9.2 Create `dist.zip`**

```
cd dist && zip -r ../pagecraft-v1.0.0.zip .
```

- ✅ Verify: zip opens cleanly and contains all required files

**9.3 Chrome Web Store submission checklist**

- [ ] Developer account registered at `chrome.google.com/webstore/devconsole`
- [ ] One-time $5 registration fee paid
- [ ] Privacy policy URL ready (required since extension reads page content)
- [ ] All permissions justified in store listing
- [ ] No `eval()` or remote code execution (MV3 compliant)
- [ ] `manifest.json` version set correctly

---

### ⚠️ Known Edge Cases to Handle in Code

| Edge Case                                 | Handling                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Google Fonts blocked by CSP on some sites | Inject font via `chrome.scripting` from background, which bypasses CSP |
| Font name has no weight on Google Fonts   | Gracefully fail, don't crash content script                            |
| CSS syntax error from user                | Wrap in try/catch, show error state in popup                           |
| Tab is a `chrome://` page                 | Disable UI in popup with a message: "Not available on this page"       |
| User types font but doesn't check box     | Save font but don't inject until checkbox is checked                   |
