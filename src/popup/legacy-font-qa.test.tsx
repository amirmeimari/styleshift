// QA-C1 acceptance: the real popup and content script must agree without
// migrating a legacy site's fonts into the shared keys.
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "./App";
import { createChromeStub } from "@/shared/test-chrome";
import {
  DEFAULT_SETTINGS,
  FONT_STYLE_ID,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
} from "@/shared/style-core";
import { DEFAULT_MONO_FONT } from "@/shared/builtin-fonts";
import { applyBackup, collectBackup } from "@/shared/backup-storage";
import { parseBackup } from "@/shared/backup";
import { translate } from "@/shared/i18n/translations";

vi.mock("@/shared/i18n/use-i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      translate("en", key, vars),
    dir: "ltr",
    locale: "en",
    setLocale: vi.fn(),
  }),
}));
vi.mock("@/shared/theme-provider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

const legacy = {
  ...DEFAULT_SETTINGS,
  fontFamily: "Lato",
  monoFontFamily: "Roboto",
  fontEnabled: true,
};
const store: Record<string, unknown> = {};
const ordered = ["Inter", "Poppins", "Open Sans"];

beforeAll(async () => {
  store[GLOBAL_ENABLED_KEY] = false;
  vi.stubGlobal("chrome", {
    ...createChromeStub(store),
    tabs: {
      query: async () => [{ id: 1, url: "https://localhost/" }],
      sendMessage: async () => {},
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  // Import once: retain one content observer/listener set for all fixtures.
  await import("@/content/content");
});
afterEach(async () => {
  cleanup();
  await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: false });
  await chrome.storage.local.remove(Object.keys(store));
  vi.restoreAllMocks();
});
afterAll(async () => {
  // Let the content observer's final repair pass finish before removing Chrome.
  await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  vi.unstubAllGlobals();
});

async function expectAgreement(text: string[], mono: string) {
  await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: true });
  const snapshot = structuredClone(store);
  const write = vi.spyOn(chrome.storage.local, "set");
  render(<App />);
  await screen.findByRole("combobox", { name: "Code font" });
  if (text.length === 0) {
    expect(
      screen.queryByRole("button", { name: /^Replace Primary:/ }),
    ).toBeNull();
    expect(screen.getByText(translate("en", "popup.noTextFonts"))).toBeTruthy();
  } else {
    for (const [index, font] of text.entries()) {
      const label =
        index === 0
          ? "Primary"
          : index === 1
            ? "Secondary"
            : `Fallback ${index + 1}`;
      expect(
        screen.getByRole("button", { name: `Replace ${label}: ${font}` }),
      ).toBeTruthy();
    }
  }
  expect(
    screen.getByRole("combobox", { name: "Code font" }).textContent,
  ).toContain(mono || translate("en", "popup.pickCodeFont"));
  // Compare complete declarations, preserving fallback order. Exclude
  // @font-face sheets: shipped family declarations do not prove application.
  await waitFor(() => {
    const css = document.getElementById(FONT_STYLE_ID)?.textContent ?? "";
    const families = [...css.matchAll(/font-family: ([^;]+) !important;/g)].map(
      (match) => match[1],
    );
    const serializedText = text
      .map((font) => (font.includes(" ") ? `"${font}"` : font))
      .join(", ");
    const serializedMono = mono.includes(" ") ? `"${mono}"` : mono;
    expect(families).toEqual([
      ...(text.length ? [serializedText] : []),
      ...(mono ? [serializedMono] : []),
    ]);
  });
  expect(write).not.toHaveBeenCalled();
  expect(store).toEqual(snapshot);
  expect(store.localhost).toEqual(legacy);
  write.mockRestore();
}

it.each([
  {
    name: "absent shared keys use defaults",
    globals: {},
    text: [],
    mono: DEFAULT_MONO_FONT,
  },
  {
    name: "explicit empty keys disable both overrides",
    globals: { [GLOBAL_FONT_STACK_KEY]: [], [GLOBAL_MONO_FONT_STACK_KEY]: [] },
    text: [],
    mono: "",
  },
  {
    name: "ordered shared pairing overrides legacy fields",
    globals: {
      [GLOBAL_FONT_STACK_KEY]: ordered,
      [GLOBAL_MONO_FONT_STACK_KEY]: ["JetBrains Mono"],
    },
    text: ordered,
    mono: "JetBrains Mono",
  },
  {
    name: "populated text and absent code remain independent",
    globals: { [GLOBAL_FONT_STACK_KEY]: ordered },
    text: ordered,
    mono: DEFAULT_MONO_FONT,
  },
  {
    name: "absent text and populated code remain independent",
    globals: { [GLOBAL_MONO_FONT_STACK_KEY]: ["Poppins"] },
    text: [],
    mono: "Poppins",
  },
  {
    name: "empty text and absent code remain independent",
    globals: { [GLOBAL_FONT_STACK_KEY]: [] },
    text: [],
    mono: DEFAULT_MONO_FONT,
  },
  {
    name: "absent text and empty code remain independent",
    globals: { [GLOBAL_MONO_FONT_STACK_KEY]: [] },
    text: [],
    mono: "",
  },
  {
    name: "populated text and empty code remain independent",
    globals: {
      [GLOBAL_FONT_STACK_KEY]: ordered,
      [GLOBAL_MONO_FONT_STACK_KEY]: [],
    },
    text: ordered,
    mono: "",
  },
  {
    name: "empty text and populated code remain independent",
    globals: {
      [GLOBAL_FONT_STACK_KEY]: [],
      [GLOBAL_MONO_FONT_STACK_KEY]: ["Poppins"],
    },
    text: [],
    mono: "Poppins",
  },
])("$name", async ({ globals, text, mono }) => {
  const fixture: Record<string, unknown> = { localhost: legacy, ...globals };
  await chrome.storage.local.set(fixture);
  await expectAgreement(text, mono);
});

it.each([
  { mode: "merge" as const, existing: false, empty: false },
  { mode: "merge" as const, existing: true, empty: false },
  { mode: "merge" as const, existing: true, empty: true },
  { mode: "replace" as const, existing: true, empty: false },
  { mode: "replace" as const, existing: true, empty: true },
])(
  "older backup $mode, existing=$existing empty=$empty",
  async ({ mode, existing, empty }) => {
    if (existing)
      await chrome.storage.local.set({
        [GLOBAL_FONT_STACK_KEY]: empty ? [] : ordered,
        [GLOBAL_MONO_FONT_STACK_KEY]: empty ? [] : ["JetBrains Mono"],
      });
    // Old v1 backup omits all newer global preferences. Exercise parsing and
    // import rather than supplying a pre-normalized settings object.
    const parsed = parseBackup(
      JSON.stringify({
        format: "styleshift-backup",
        version: 1,
        sites: { localhost: legacy },
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.globals).toEqual({});
    await applyBackup(parsed.backup, mode);
    const kept = existing && mode === "merge";
    const text = kept && !empty ? ordered : [];
    const mono = kept ? (empty ? "" : "JetBrains Mono") : DEFAULT_MONO_FONT;
    await expectAgreement(text, mono);
    expect(Object.hasOwn(store, GLOBAL_FONT_STACK_KEY)).toBe(kept);
    expect(Object.hasOwn(store, GLOBAL_MONO_FONT_STACK_KEY)).toBe(kept);
    const exported = await collectBackup(false);
    expect(exported.sites.localhost).toEqual(legacy);
    expect(exported.globals.fontStack).toEqual(text);
    expect(exported.globals.monoFontStack).toEqual(mono ? [mono] : []);
  },
);

it.each(["merge", "replace"] as const)(
  "exports absent-key effective defaults and reimports them through %s",
  async (mode) => {
    await chrome.storage.local.set({ localhost: legacy });
    await expectAgreement([], DEFAULT_MONO_FONT);
    const snapshot = structuredClone(store);
    const exported = await collectBackup(false);
    expect(store).toEqual(snapshot);
    expect(exported.globals.fontStack).toEqual([]);
    expect(exported.globals.monoFontStack).toEqual([DEFAULT_MONO_FONT]);
    expect(exported.sites.localhost).toEqual(legacy);
    const parsed = parseBackup(JSON.stringify(exported));
    if (!parsed.ok) throw new Error(parsed.error);
    cleanup();
    await chrome.storage.local.set({
      [GLOBAL_FONT_STACK_KEY]: ordered,
      [GLOBAL_MONO_FONT_STACK_KEY]: ["Poppins"],
    });
    await applyBackup(parsed.backup, mode);
    await expectAgreement([], DEFAULT_MONO_FONT);
    expect(store[GLOBAL_FONT_STACK_KEY]).toEqual([]);
    expect(store[GLOBAL_MONO_FONT_STACK_KEY]).toEqual([DEFAULT_MONO_FONT]);
  },
);

it.each(["merge", "replace"] as const)(
  "keeps imported explicit empty stacks disabled through %s and export/reimport",
  async (mode) => {
    await chrome.storage.local.set({
      [GLOBAL_FONT_STACK_KEY]: ordered,
      [GLOBAL_MONO_FONT_STACK_KEY]: ["JetBrains Mono"],
    });
    const parsed = parseBackup(
      JSON.stringify({
        format: "styleshift-backup",
        version: 1,
        globals: { fontStack: [], monoFontStack: [] },
        sites: { localhost: legacy },
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    await applyBackup(parsed.backup, mode);
    await expectAgreement([], "");
    const exported = await collectBackup(false);
    expect(exported.globals.fontStack).toEqual([]);
    expect(exported.globals.monoFontStack).toEqual([]);
    expect(exported.sites.localhost).toEqual(legacy);
    cleanup();

    // A downloaded JSON round trip must retain intentional emptiness even
    // when it replaces a profile with populated overrides.
    const roundTrip = parseBackup(JSON.stringify(exported));
    if (!roundTrip.ok) throw new Error(roundTrip.error);
    await chrome.storage.local.set({
      [GLOBAL_FONT_STACK_KEY]: ordered,
      [GLOBAL_MONO_FONT_STACK_KEY]: ["JetBrains Mono"],
    });
    await applyBackup(roundTrip.backup, "replace");
    await expectAgreement([], "");
    expect(store[GLOBAL_FONT_STACK_KEY]).toEqual([]);
    expect(store[GLOBAL_MONO_FONT_STACK_KEY]).toEqual([]);
  },
);

it("preserves legacy host values when explicitly editing the shared pairing", async () => {
  await chrome.storage.local.set({ localhost: legacy });
  await expectAgreement([], DEFAULT_MONO_FONT);
  fireEvent.click(screen.getByRole("button", { name: "Add fallback" }));
  fireEvent.click(await screen.findByRole("option", { name: /^Inter/ }));
  await waitFor(() => expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Inter"]));
  await waitFor(() =>
    expect(document.getElementById(FONT_STYLE_ID)?.textContent).toContain(
      "font-family: Inter !important",
    ),
  );
  expect(store.localhost).toEqual(legacy);
  expect(Object.hasOwn(store, GLOBAL_MONO_FONT_STACK_KEY)).toBe(false);
  fireEvent.click(screen.getByRole("combobox", { name: "Code font" }));
  fireEvent.click(await screen.findByRole("option", { name: "No code font" }));
  await waitFor(() => expect(store[GLOBAL_MONO_FONT_STACK_KEY]).toEqual([]));
  await waitFor(() => {
    const css = document.getElementById(FONT_STYLE_ID)?.textContent ?? "";
    expect(css).toContain("font-family: Inter !important");
    expect(css).not.toContain(DEFAULT_MONO_FONT);
  });
  expect(store.localhost).toEqual(legacy);
  expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Inter"]);
});

it("keeps separate typed font histories after switching and reopening the popup", async () => {
  await chrome.storage.local.set({ localhost: legacy });
  await expectAgreement([], DEFAULT_MONO_FONT);

  fireEvent.click(screen.getByRole("combobox", { name: "Code font" }));
  const input = screen.getByRole("combobox", {
    name: "Search or type a font name",
  });
  fireEvent.change(input, { target: { value: "  My Local Mono  " } });

  const option = await screen.findByRole("option", {
    name: "Add font My Local Mono",
  });
  await waitFor(() =>
    expect(option.getAttribute("aria-selected")).toBe("true"),
  );
  fireEvent.keyDown(input, { key: "Enter" });

  await waitFor(() =>
    expect(store[GLOBAL_MONO_FONT_STACK_KEY]).toEqual(["My Local Mono"]),
  );
  expect(Object.hasOwn(store, GLOBAL_FONT_STACK_KEY)).toBe(false);
  cleanup();
  // jsdom has no installed fonts, so simulate Chrome resolving this family.
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts");
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { check: (spec: string) => spec === '12px "My Local Mono"' },
  });
  try {
    await expectAgreement([], "My Local Mono");
    fireEvent.click(screen.getByRole("combobox", { name: "Code font" }));
    fireEvent.click(
      await screen.findByRole("option", { name: /^JetBrains Mono/ }),
    );
    await waitFor(() =>
      expect(store[GLOBAL_MONO_FONT_STACK_KEY]).toEqual(["JetBrains Mono"]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add fallback" }));
    const pairingInput = await screen.findByPlaceholderText(
      "Search or type a font name",
    );
    fireEvent.change(pairingInput, { target: { value: "My Local Text" } });
    fireEvent.keyDown(pairingInput, { key: "Enter" });
    await waitFor(() =>
      expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["My Local Text"]),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Replace Primary: My Local Text" }),
    );
    fireEvent.click(await screen.findByRole("option", { name: /^Inter/ }));
    await waitFor(() =>
      expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Inter"]),
    );

    cleanup();
    await expectAgreement(["Inter"], "JetBrains Mono");
    fireEvent.click(
      screen.getByRole("button", { name: "Replace Primary: Inter" }),
    );
    expect(
      await screen.findByRole("option", { name: /^My Local Text/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /^My Local Mono/ })).toBeNull();
    fireEvent.keyDown(
      screen.getByPlaceholderText("Search or type a font name"),
      {
        key: "Escape",
      },
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Code font" }));
    const savedCodeFont = await screen.findByRole("option", {
      name: /^My Local Mono/,
    });
    expect(screen.queryByRole("option", { name: /^My Local Text/ })).toBeNull();
    fireEvent.click(savedCodeFont);
    await waitFor(() =>
      expect(store[GLOBAL_MONO_FONT_STACK_KEY]).toEqual(["My Local Mono"]),
    );
  } finally {
    if (fonts) Object.defineProperty(document, "fonts", fonts);
    else Reflect.deleteProperty(document, "fonts");
  }
});
