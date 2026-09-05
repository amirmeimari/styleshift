// Pure - no chrome stub needed. The one invariant that matters most here:
// isHostSettingsKey/sanitizeSettings must never let a reserved global key or
// a font-chunk key sneak into "sites", because that path leads straight to
// chrome.storage.local.set on import.

import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  buildBackup,
  isHostSettingsKey,
  parseBackup,
  sanitizeSettings,
  serializeBackup,
  type StyleShiftBackup,
} from "./backup";
import { DEFAULT_SETTINGS, type StyleShiftSettings } from "./style-core";

const SITE: StyleShiftSettings = {
  ...DEFAULT_SETTINGS,
  fontFamily: "Inter",
  fontEnabled: true,
  customCSS: "body { color: red; }",
};

function makeBackup(
  overrides: Partial<StyleShiftBackup> = {},
): StyleShiftBackup {
  return buildBackup({
    globals: { enabled: true, autoEnableAllSites: false },
    sites: { "github.com": SITE },
    ...overrides,
  });
}

describe("isHostSettingsKey", () => {
  it("rejects every reserved global key by name", () => {
    expect(isHostSettingsKey("__styleshift_enabled__")).toBe(false);
    expect(isHostSettingsKey("__styleshift_typography__")).toBe(false);
    expect(isHostSettingsKey("__styleshift_locale__")).toBe(false);
    expect(isHostSettingsKey("__styleshift_theme__")).toBe(false);
    expect(isHostSettingsKey("__styleshift_custom_font_index__")).toBe(false);
  });

  it("rejects a font-chunk-prefixed key", () => {
    expect(isHostSettingsKey("__styleshift_custom_font_chunk__abc_0")).toBe(
      false,
    );
  });

  it("accepts an ordinary hostname", () => {
    expect(isHostSettingsKey("github.com")).toBe(true);
    expect(isHostSettingsKey("gist.github.com")).toBe(true);
  });
});

describe("sanitizeSettings", () => {
  it("coerces a missing cssEnabled to the default (true)", () => {
    expect(sanitizeSettings({}).cssEnabled).toBe(true);
  });

  it("does not truthy-coerce a string into a boolean field", () => {
    expect(sanitizeSettings({ cssEnabled: "yes" }).cssEnabled).toBe(true); // falls back to default, not Boolean("yes")
    expect(sanitizeSettings({ cssEnabled: false }).cssEnabled).toBe(false);
    expect(sanitizeSettings({ fontEnabled: "true" }).fontEnabled).toBe(
      DEFAULT_SETTINGS.fontEnabled,
    );
  });

  it("truncates an oversized customCSS instead of rejecting the whole record", () => {
    const huge = "a".repeat(200_000);
    const result = sanitizeSettings({ customCSS: huge });
    expect(result.customCSS.length).toBeLessThan(huge.length);
    expect(result.customCSS.length).toBe(100_000);
  });

  it("defaults includeSubdomains to true when absent or non-boolean", () => {
    expect(sanitizeSettings({}).includeSubdomains).toBe(true);
    expect(
      sanitizeSettings({ includeSubdomains: "no" }).includeSubdomains,
    ).toBe(true);
    expect(
      sanitizeSettings({ includeSubdomains: false }).includeSubdomains,
    ).toBe(false);
  });

  it("drops unknown fields and never spreads the raw object", () => {
    const result = sanitizeSettings({
      fontFamily: "Inter",
      extraField: "should not appear",
    } as unknown);
    expect(result).not.toHaveProperty("extraField");
    expect(result).toEqual({
      ...DEFAULT_SETTINGS,
      fontFamily: "Inter",
    });
  });

  it("does not pick up an own '__proto__' property from parsed JSON", () => {
    // A plain object literal's `__proto__` key sets the prototype rather than
    // creating an own property, so this has to go through JSON.parse (as a
    // real imported backup would) to actually exercise the hazard.
    const raw = JSON.parse(
      '{"__proto__":{"polluted":true},"fontFamily":"Inter"}',
    );
    const result = sanitizeSettings(raw) as unknown as Record<string, unknown>;
    expect(result.polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("is idempotent - sanitizing an already-sanitized record is a no-op", () => {
    const once = sanitizeSettings({ fontFamily: "Inter", cssEnabled: false });
    expect(sanitizeSettings(once)).toEqual(once);
  });
});

describe("parseBackup", () => {
  it("rejects invalid JSON", () => {
    const result = parseBackup("{not json");
    expect(result).toEqual({ ok: false, error: "invalid-json" });
  });

  it("rejects a file with the wrong format string", () => {
    const result = parseBackup(JSON.stringify({ format: "something-else" }));
    expect(result).toEqual({ ok: false, error: "not-a-backup" });
  });

  it("rejects a version newer than this build supports", () => {
    const result = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1 }),
    );
    expect(result).toEqual({ ok: false, error: "unsupported-version" });
  });

  it("drops a site key that is actually a reserved global, by name", () => {
    const backup = makeBackup({
      sites: {
        "github.com": SITE,
        __styleshift_enabled__: SITE,
      },
    });
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.sites).toHaveProperty("github.com");
    expect(result.backup.sites).not.toHaveProperty("__styleshift_enabled__");
    expect(result.warnings.some((w) => w.includes("dropped"))).toBe(true);
  });

  it("drops a site key prefixed like a font chunk, by name", () => {
    const backup = makeBackup({
      sites: {
        "github.com": SITE,
        __styleshift_custom_font_chunk__evil_0: SITE,
      },
    });
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.sites).not.toHaveProperty(
      "__styleshift_custom_font_chunk__evil_0",
    );
  });

  it("clamps typography through the same normalizeTypography the emit path uses", () => {
    const backup = makeBackup({
      globals: {
        typography: {
          lineHeight: 99,
          letterSpacing: 0,
          fontWeight: 0,
          minFontSize: 0,
        },
      },
    });
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 99 is out of the [1,3] range - clamped, not passed through.
    expect(result.backup.globals.typography?.lineHeight).toBe(3);
  });

  it("drops an oversized or non-base64 font entry without failing the rest of the import", () => {
    const backup = makeBackup({
      fonts: [
        {
          id: "good",
          name: "Good Font",
          format: "woff2",
          mimeType: "font/woff2",
          data: "AAAA",
        },
        {
          id: "bad",
          name: "Bad Font",
          format: "woff2",
          mimeType: "font/woff2",
          data: "not-base64!!!",
        },
      ],
    });
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.fonts?.map((f) => f.id)).toEqual(["good"]);
    expect(result.warnings.some((w) => w.includes("font"))).toBe(true);
  });

  it("settings-only export has no fonts key at all", () => {
    const backup = makeBackup();
    expect(backup.fonts).toBeUndefined();
    expect(JSON.stringify(backup)).not.toContain('"fonts"');
  });

  it("round-trips an already-sanitized backup exactly", () => {
    const backup = makeBackup();
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup).toEqual(backup);
  });
});

describe("backupFilename", () => {
  it("formats as styleshift-backup-YYYY-MM-DD.json", () => {
    expect(backupFilename(new Date(2026, 8, 5))).toBe(
      "styleshift-backup-2026-09-05.json",
    );
  });
});
