// Needs a stubbed chrome.storage.local - the pure validation is already
// covered by backup.test.ts. What matters here is storage-shape correctness:
// replace mode must remove font chunk keys alongside the index (not just the
// index), and merge mode must leave an untouched host record intact.

import { beforeEach, describe, expect, it } from "vitest";
import { applyBackup, collectBackup } from "./backup-storage";
import { buildBackup } from "./backup";
import {
  CUSTOM_FONT_INDEX_KEY,
  DEFAULT_SETTINGS,
  GLOBAL_ENABLED_KEY,
  type StyleShiftSettings,
} from "./style-core";
import { updateCustomFont } from "./custom-fonts";
import { updateHostSettings } from "./storage";
import { stubChrome } from "./test-chrome";

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  stubChrome(store);
});

const SITE: StyleShiftSettings = {
  ...DEFAULT_SETTINGS,
  fontFamily: "Inter",
  fontEnabled: true,
  customCSS: "body { color: red; }",
};

describe("collectBackup", () => {
  it("collects every host settings record and the globals it knows about", async () => {
    await updateHostSettings("github.com", SITE);
    await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: false });

    const backup = await collectBackup(false);
    expect(backup.sites["github.com"]).toEqual(SITE);
    expect(backup.globals.enabled).toBe(false);
    expect(backup.fonts).toBeUndefined();
  });

  it("includes fonts only when asked", async () => {
    await updateCustomFont({
      id: "font-1",
      name: "Test Font",
      format: "woff2",
      mimeType: "font/woff2",
      data: "AAAA",
    });

    const withoutFonts = await collectBackup(false);
    expect(withoutFonts.fonts).toBeUndefined();

    const withFonts = await collectBackup(true);
    expect(withFonts.fonts?.map((f) => f.id)).toEqual(["font-1"]);
  });
});

describe("applyBackup - merge mode", () => {
  it("writes the backup's sites without touching an untouched host record", async () => {
    await updateHostSettings("untouched.com", SITE);

    const backup = buildBackup({
      globals: {},
      sites: { "github.com": SITE },
    });
    await applyBackup(backup, "merge");

    const stored = (await chrome.storage.local.get(null)) as Record<
      string,
      unknown
    >;
    expect(stored["github.com"]).toEqual(SITE);
    expect(stored["untouched.com"]).toEqual(SITE);
  });

  it("only writes globals present in the backup", async () => {
    await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: false });

    const backup = buildBackup({ globals: {}, sites: {} });
    const report = await applyBackup(backup, "merge");

    expect(report.globalsWritten).toEqual([]);
    const stored = (await chrome.storage.local.get(
      GLOBAL_ENABLED_KEY,
    )) as Record<string, unknown>;
    expect(stored[GLOBAL_ENABLED_KEY]).toBe(false); // untouched
  });

  it("merges an imported font in alongside an existing one, not over it", async () => {
    await updateCustomFont({
      id: "existing",
      name: "Existing Font",
      format: "woff2",
      mimeType: "font/woff2",
      data: "AAAA",
    });

    const backup = buildBackup({
      globals: {},
      sites: {},
      fonts: [
        {
          id: "imported",
          name: "Imported Font",
          format: "woff2",
          mimeType: "font/woff2",
          data: "BBBB",
        },
      ],
    });
    await applyBackup(backup, "merge");

    const index = (
      (await chrome.storage.local.get(CUSTOM_FONT_INDEX_KEY)) as Record<
        string,
        Record<string, unknown> | undefined
      >
    )[CUSTOM_FONT_INDEX_KEY];
    expect(Object.keys(index ?? {}).sort()).toEqual(["existing", "imported"]);
  });
});

describe("applyBackup - replace mode", () => {
  it("removes a site not mentioned in the backup", async () => {
    await updateHostSettings("stale.com", SITE);

    const backup = buildBackup({ globals: {}, sites: { "github.com": SITE } });
    await applyBackup(backup, "replace");

    const stored = (await chrome.storage.local.get(null)) as Record<
      string,
      unknown
    >;
    expect(stored["github.com"]).toEqual(SITE);
    expect(stored).not.toHaveProperty("stale.com");
  });

  it("removes font chunk keys alongside the index when the backup has no fonts", async () => {
    await updateCustomFont({
      id: "old-font",
      name: "Old Font",
      format: "woff2",
      mimeType: "font/woff2",
      data: "AAAA",
    });
    const beforeKeys = Object.keys(store).filter((key) =>
      key.startsWith("__styleshift_custom_font_chunk__"),
    );
    expect(beforeKeys.length).toBeGreaterThan(0);

    const backup = buildBackup({ globals: {}, sites: {} }); // no fonts
    await applyBackup(backup, "replace");

    const stored = (await chrome.storage.local.get(null)) as Record<
      string,
      unknown
    >;
    expect(stored).not.toHaveProperty(CUSTOM_FONT_INDEX_KEY);
    for (const key of beforeKeys) {
      expect(stored).not.toHaveProperty(key);
    }
  });

  it("replaces the font set entirely: old font's chunks gone, new font's chunks present", async () => {
    await updateCustomFont({
      id: "old-font",
      name: "Old Font",
      format: "woff2",
      mimeType: "font/woff2",
      data: "AAAA",
    });
    const oldChunkKeys = Object.keys(store).filter((key) =>
      key.startsWith("__styleshift_custom_font_chunk__old-font"),
    );
    expect(oldChunkKeys.length).toBeGreaterThan(0);

    const backup = buildBackup({
      globals: {},
      sites: {},
      fonts: [
        {
          id: "new-font",
          name: "New Font",
          format: "woff2",
          mimeType: "font/woff2",
          data: "BBBB",
        },
      ],
    });
    const report = await applyBackup(backup, "replace");
    expect(report.fontsWritten).toBe(1);

    const stored = (await chrome.storage.local.get(null)) as Record<
      string,
      unknown
    >;
    for (const key of oldChunkKeys) {
      expect(stored).not.toHaveProperty(key);
    }
    const newChunkKeys = Object.keys(stored).filter((key) =>
      key.startsWith("__styleshift_custom_font_chunk__new-font"),
    );
    expect(newChunkKeys.length).toBeGreaterThan(0);

    const index = (stored[CUSTOM_FONT_INDEX_KEY] ?? {}) as Record<
      string,
      unknown
    >;
    expect(Object.keys(index)).toEqual(["new-font"]);
  });

  it("resets a global absent from the backup back to its default", async () => {
    await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: false });

    const backup = buildBackup({ globals: {}, sites: {} });
    await applyBackup(backup, "replace");

    const stored = (await chrome.storage.local.get(
      GLOBAL_ENABLED_KEY,
    )) as Record<string, unknown>;
    expect(stored).not.toHaveProperty(GLOBAL_ENABLED_KEY);
  });
});
