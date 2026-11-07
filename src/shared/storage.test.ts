// resolveHostSettings / readHostSettings / updateHostSettings /
// clearHostSettings against a stubbed chrome.storage.local. The invariant
// worth pinning here: readHostSettings' signature and behavior are unchanged
// for the two cases that existed before subdomain scoping (a host with its
// own record, a host with neither its own nor an ancestor's) - the only new
// behavior is the third case, where an ancestor record now resolves.

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearHostSettings,
  readGlobalFontStack,
  readGlobalCSS,
  readGlobalFontStackEntry,
  readGlobalMonoFontStack,
  readGlobalMonoFontStackEntry,
  readHostSettings,
  resolveHostSettings,
  updateHostSettings,
  updateGlobalFontStack,
  updateGlobalCSS,
  updateGlobalMonoFontStack,
  updateTypography,
} from "./storage";
import {
  AUTO_ENABLE_ALL_SITES_KEY,
  TYPOGRAPHY_KEY,
  DEFAULT_SETTINGS,
  isPreActivatedHost,
} from "./style-core";
import { stubChrome } from "./test-chrome";

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  stubChrome(store);
});

describe("resolveHostSettings", () => {
  it("an own record always wins over an ancestor's", async () => {
    await updateHostSettings("github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      customCSS: "body { color: red; }",
    });
    await updateHostSettings("gist.github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: false,
      customCSS: "body { color: blue; }",
    });

    const resolved = await resolveHostSettings("gist.github.com");
    expect(resolved.sourceHost).toBe("gist.github.com");
    expect(resolved.inherited).toBe(false);
    expect(resolved.settings.customCSS).toBe("body { color: blue; }");
  });

  it("inherits an ancestor's record when the host has none of its own", async () => {
    await updateHostSettings("github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      customCSS: "body { color: red; }",
    });

    const resolved = await resolveHostSettings("gist.github.com");
    expect(resolved.sourceHost).toBe("github.com");
    expect(resolved.inherited).toBe(true);
    expect(resolved.settings.fontEnabled).toBe(true);
    expect(resolved.settings.customCSS).toBe("body { color: red; }");
  });

  it("absent includeSubdomains still inherits (the compat case)", async () => {
    const legacyRecord = { ...DEFAULT_SETTINGS, fontEnabled: true } as Record<
      string,
      unknown
    >;
    delete legacyRecord.includeSubdomains;
    await updateHostSettings(
      "github.com",
      legacyRecord as unknown as Parameters<typeof updateHostSettings>[1],
    );

    const resolved = await resolveHostSettings("gist.github.com");
    expect(resolved.sourceHost).toBe("github.com");
    expect(resolved.inherited).toBe(true);
  });

  it("includeSubdomains: false blocks inheritance", async () => {
    await updateHostSettings("github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      includeSubdomains: false,
    });

    const resolved = await resolveHostSettings("gist.github.com");
    expect(resolved.sourceHost).toBeNull();
    expect(resolved.inherited).toBe(false);
    expect(resolved.settings.customCSS).toBe(DEFAULT_SETTINGS.customCSS);
  });

  it("nearest ancestor decides: an opted-out middle ancestor stops the walk", async () => {
    await updateHostSettings("github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      customCSS: "body { color: red; }",
    });
    await updateHostSettings("b.github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: false,
      includeSubdomains: false,
    });

    const resolved = await resolveHostSettings("a.b.github.com");
    // Blocked at b.github.com - must NOT reach past it to github.com.
    expect(resolved.sourceHost).toBeNull();
    expect(resolved.settings.customCSS).toBe(DEFAULT_SETTINGS.customCSS);
  });

  it("falls back to defaults when nothing matches, fontEnabled from isPreActivatedHost", async () => {
    const resolved = await resolveHostSettings("gist.github.com");
    expect(resolved.sourceHost).toBeNull();
    expect(resolved.inherited).toBe(false);
    expect(resolved.settings.fontEnabled).toBe(
      isPreActivatedHost("gist.github.com"),
    );
  });

  it("an ancestor record with fontEnabled absent still falls back to the global auto-enable flag", async () => {
    store[AUTO_ENABLE_ALL_SITES_KEY] = true;

    const recordWithoutFontEnabled = {
      ...DEFAULT_SETTINGS,
      customCSS: "body { color: green; }",
    } as Record<string, unknown>;
    delete recordWithoutFontEnabled.fontEnabled;
    await updateHostSettings(
      "example.com",
      recordWithoutFontEnabled as unknown as Parameters<
        typeof updateHostSettings
      >[1],
    );

    const resolved = await resolveHostSettings("sub.example.com");
    expect(resolved.sourceHost).toBe("example.com");
    expect(resolved.settings.fontEnabled).toBe(true);
    expect(resolved.settings.customCSS).toBe("body { color: green; }");
  });
});

describe("readHostSettings (unchanged signature/behavior for the pre-existing cases)", () => {
  it("resolves identically to before for a host with its own record", async () => {
    await updateHostSettings("github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      customCSS: "body { color: red; }",
    });

    const settings = await readHostSettings("github.com");
    expect(settings.fontEnabled).toBe(true);
    expect(settings.customCSS).toBe("body { color: red; }");
  });

  it("resolves identically to before for a host with no record at all", async () => {
    const settings = await readHostSettings("example.org");
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      fontEnabled: isPreActivatedHost("example.org"),
    });
  });

  it("isPreActivatedHost still drives fontEnabled with no record anywhere", async () => {
    const settings = await readHostSettings("gist.github.com");
    expect(settings.fontEnabled).toBe(true);
  });
});

describe("updateHostSettings / clearHostSettings round-trip", () => {
  it("clearing an own record falls back to inheritance again", async () => {
    await updateHostSettings("github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      customCSS: "body { color: red; }",
    });
    await updateHostSettings("gist.github.com", {
      ...DEFAULT_SETTINGS,
      fontEnabled: false,
      customCSS: "body { color: blue; }",
    });

    expect((await resolveHostSettings("gist.github.com")).sourceHost).toBe(
      "gist.github.com",
    );

    await clearHostSettings("gist.github.com");

    const resolved = await resolveHostSettings("gist.github.com");
    expect(resolved.sourceHost).toBe("github.com");
    expect(resolved.settings.customCSS).toBe("body { color: red; }");
  });

  it("clearing a host with no ancestor record falls back to defaults", async () => {
    await updateHostSettings("example.org", {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      customCSS: "body { color: red; }",
    });

    await clearHostSettings("example.org");

    const resolved = await resolveHostSettings("example.org");
    expect(resolved.sourceHost).toBeNull();
    expect(resolved.settings.customCSS).toBe(DEFAULT_SETTINGS.customCSS);
  });
});

describe("global and site CSS storage", () => {
  it("keeps the independent global key when a site is edited and reset", async () => {
    await updateGlobalCSS("body { color: blue; }");
    await updateHostSettings("example.org", {
      ...DEFAULT_SETTINGS,
      customCSS: "body { color: red; }",
      cssEnabled: false,
      includeSubdomains: false,
    });

    expect(await readGlobalCSS()).toBe("body { color: blue; }");
    expect((await readHostSettings("example.org")).customCSS).toBe(
      "body { color: red; }",
    );
    await clearHostSettings("example.org");
    expect(await readGlobalCSS()).toBe("body { color: blue; }");
    expect((await readHostSettings("example.org")).customCSS).toBe("");
  });
});

describe("updateTypography", () => {
  it("preserves fields changed by a backup import or another extension page", async () => {
    await updateTypography({ lineHeight: 1.5 });
    await chrome.storage.local.set({
      [TYPOGRAPHY_KEY]: {
        lineHeight: 2,
        letterSpacing: 0.1,
        fontWeight: 700,
        minFontSize: 18,
      },
    });
    expect(await updateTypography({ minFontSize: 20 })).toEqual({
      lineHeight: 2,
      letterSpacing: 0.1,
      fontWeight: 700,
      minFontSize: 20,
    });
  });

  it("does not lose a field from a concurrent update to a different field", async () => {
    // Two overlapping calls (e.g. dragging one slider right after another,
    // both firing before the first write lands) each read-modify-write the
    // same stored object; without serializing them, the second call can read
    // before the first call's write completes and clobber it on write.
    const [first, second] = await Promise.all([
      updateTypography({ lineHeight: 1.6 }),
      updateTypography({ letterSpacing: 0.02 }),
    ]);

    expect(second.lineHeight).toBe(first.lineHeight);
    expect(second).toEqual({
      lineHeight: 1.6,
      letterSpacing: 0.02,
      fontWeight: null,
      minFontSize: null,
    });
  });
});

describe("global ordered font stacks", () => {
  it("distinguishes an absent legacy key from an explicitly empty stack", async () => {
    expect(await readGlobalFontStackEntry()).toEqual({
      value: [],
      exists: false,
    });
    await updateGlobalFontStack([]);
    expect(await readGlobalFontStackEntry()).toEqual({
      value: [],
      exists: true,
    });

    await updateGlobalMonoFontStack([]);
    expect(await readGlobalMonoFontStackEntry()).toEqual({
      value: [],
      exists: true,
    });
  });

  it("round-trips text fallbacks without reordering them", async () => {
    const stack = ["Inter", "Vazirmatn", "Noto Sans"];
    await updateGlobalFontStack(stack);
    expect(await readGlobalFontStack()).toEqual(stack);
  });

  it("keeps the code font in its separate global stack", async () => {
    await updateGlobalFontStack(["Inter", "Vazirmatn"]);
    await updateGlobalMonoFontStack(["JetBrains Mono"]);
    expect(await readGlobalFontStack()).toEqual(["Inter", "Vazirmatn"]);
    expect(await readGlobalMonoFontStack()).toEqual(["JetBrains Mono"]);
  });
});
