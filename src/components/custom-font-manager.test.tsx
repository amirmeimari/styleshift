import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { CustomFontManager } from "./custom-font-manager";
import { createChromeStub } from "@/shared/test-chrome";
import {
  CUSTOM_FONTS_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
} from "@/shared/style-core";
import { readCustomFonts, updateCustomFont } from "@/shared/custom-fonts";
import { applyBackup, collectBackup } from "@/shared/backup-storage";
import { parseBackup } from "@/shared/backup";
import { validateFontData } from "@/shared/font-validation";
import { translate } from "@/shared/i18n/translations";

vi.mock("@/shared/i18n/use-i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      translate("en", key, vars),
  }),
}));

let store: Record<string, unknown>;
const decoded: Uint8Array[] = [];
beforeEach(() => {
  store = {};
  decoded.length = 0;
  vi.stubGlobal("chrome", createChromeStub(store));
  vi.stubGlobal(
    "FontFace",
    class {
      constructor(
        _family: string,
        private bytes: Uint8Array,
      ) {
        decoded.push(bytes);
      }
      async load() {
        if (String.fromCharCode(...this.bytes) === "corrupt")
          throw new Error("decode failed");
        return this;
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function upload(container: HTMLElement, files: File[]) {
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files },
  });
}

it.each(["legacy", "chunked"])(
  "rejects a corrupt replacement without writing to %s storage, preserving bytes, order and settings",
  async (storage) => {
    const font = {
      id: "old",
      name: "Working",
      data: btoa("valid".repeat(1800)),
      format: "woff2",
      mimeType: "font/woff2",
    };
    if (storage === "legacy") store[CUSTOM_FONTS_KEY] = { old: font };
    else await updateCustomFont(font);
    store[GLOBAL_FONT_STACK_KEY] = ["Inter", "Working", "Lato"];
    store[GLOBAL_MONO_FONT_STACK_KEY] = ["JetBrains Mono"];
    store["example.com"] = {
      fontEnabled: true,
      customCSS: "body { color: red; }",
    };
    const original = structuredClone(store);
    const changed = vi.fn();
    const set = vi.spyOn(chrome.storage.local, "set");
    const remove = vi.spyOn(chrome.storage.local, "remove");
    const { container } = render(
      <CustomFontManager onFontsChanged={changed} />,
    );
    await screen.findByText(/decoded successfully/);
    upload(container, [new File(["corrupt"], "working.woff2")]);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Cannot decode working.woff2",
      ),
    );
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(store).toEqual(original);
    expect((await readCustomFonts()).old.data).toBe(font.data);
    expect(changed).not.toHaveBeenCalled();
    expect(
      decoded.some((bytes) => String.fromCharCode(...bytes) === "corrupt"),
    ).toBe(true);
  },
);

it.each(["woff2", "woff", "ttf", "otf"])(
  "validates bytes and accepts a decodable %s upload",
  async (format) => {
    const { container } = render(<CustomFontManager />);
    upload(container, [new File(["valid"], `Accepted.${format}`)]);
    await screen.findByRole("status");
    const fonts = Object.values(await readCustomFonts());
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({
      name: "Accepted",
      mimeType: `font/${format}`,
      format,
      data: btoa("valid"),
    });
    expect((await collectBackup(true)).fonts).toEqual(fonts);
    expect(decoded.length).toBeGreaterThan(0);
  },
);

it("preserves nonempty upload MIME, exact bytes, IDs and order through backup Replace", async () => {
  const cases = [
    ["WOFF2", "application/octet-stream"],
    ["WOFF", "application/font-woff"],
    ["TTF", "application/x-font-ttf"],
    ["OTF", "font/otf"],
  ];
  const bytes = new Uint8Array([0, 255, 128, 13, 10, 65]);
  store[GLOBAL_FONT_STACK_KEY] = ["Review WOFF2", "Review WOFF", "Inter"];
  store[GLOBAL_MONO_FONT_STACK_KEY] = ["Review TTF", "JetBrains Mono"];
  const { container } = render(<CustomFontManager />);
  upload(
    container,
    cases.map(
      ([format, type]) =>
        new File([bytes], `Review ${format}.${format}`, { type }),
    ),
  );
  await screen.findByRole("status");
  const exported = await collectBackup(true);
  expect(
    exported.fonts?.map(({ name, mimeType, format, data }) => ({
      name,
      mimeType,
      format,
      data,
    })),
  ).toEqual(
    cases.map(([format, mimeType]) => ({
      name: `Review ${format}`,
      mimeType,
      format: format.toLowerCase(),
      data: "AP+ADQpB",
    })),
  );
  const parsed = parseBackup(JSON.stringify(exported));
  if (!parsed.ok) throw new Error(parsed.error);
  expect(parsed.warnings).toEqual([]);
  await applyBackup(parsed.backup, "replace");
  const restored = await collectBackup(true);
  expect(restored.fonts).toEqual(exported.fonts);
  expect(restored.globals).toEqual(exported.globals);
});

it.each(["missing", "empty"])(
  "accepts %s MIME in a backup while independently reporting corrupt bytes in Library",
  async (mime) => {
    const font = {
      id: "review-invalid",
      name: "Review Invalid",
      format: "woff2",
      data: btoa("corrupt"),
      ...(mime === "empty" ? { mimeType: "" } : {}),
    };
    const parsed = parseBackup(
      JSON.stringify({
        format: "styleshift-backup",
        version: 1,
        fonts: [font],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.backup.fonts).toEqual([{ ...font, mimeType: "font/woff2" }]);
    await applyBackup(parsed.backup, "replace");
    expect(decoded).toEqual([]);
    const original = structuredClone(store);
    render(<CustomFontManager />);
    await screen.findByText(/Cannot decode this font/);
    expect(screen.queryByText(/decoded successfully/)).toBeNull();
    expect(store).toEqual(original);
    expect((await collectBackup(true)).fonts).toEqual([
      expect.objectContaining({ ...font, mimeType: "font/woff2" }),
    ]);
  },
);

it.each(["legacy", "imported chunked"])(
  "checks %s corrupt bytes without modifying them or promising availability",
  async (storage) => {
    const font = {
      id: "bad",
      name: "Imported",
      data: btoa("corrupt"),
      format: "woff2",
      mimeType: "font/woff2",
    };
    if (storage === "legacy") store[CUSTOM_FONTS_KEY] = { bad: font };
    else {
      const parsed = parseBackup(
        JSON.stringify({
          format: "styleshift-backup",
          version: 1,
          sites: {},
          fonts: [font],
        }),
      );
      if (!parsed.ok) throw new Error(parsed.error);
      await applyBackup(parsed.backup, "merge");
    }
    const original = structuredClone(store);
    render(<CustomFontManager />);
    await screen.findByText(/Cannot decode this font/);
    expect(screen.queryByText(/always available/)).toBeNull();
    expect(store).toEqual(original);
    expect((await collectBackup(true)).fonts).toEqual([
      expect.objectContaining(font),
    ]);
  },
);

it("continues a mixed batch after rejecting a corrupt file and reports the failure", async () => {
  const { container } = render(<CustomFontManager />);
  upload(container, [
    new File(["corrupt"], "Bad.ttf"),
    new File(["valid"], "Good.otf"),
  ]);
  await screen.findByRole("alert");
  expect(
    Object.values(await readCustomFonts()).map((font) => font.name),
  ).toEqual(["Good"]);
  expect(screen.queryByRole("status")).toBeNull();
});

it("fails closed when browser decoding is unavailable", async () => {
  vi.stubGlobal("FontFace", undefined);
  const { container } = render(<CustomFontManager />);
  upload(container, [new File(["valid"], "Unverified.woff")]);
  await screen.findByRole("alert");
  expect(await readCustomFonts()).toEqual({});
});

it.each(["Inter", "Arial"])(
  "rejects corrupt bytes even when named like an available %s family",
  async (name) => {
    const set = vi.spyOn(chrome.storage.local, "set");
    const { container } = render(<CustomFontManager />);
    upload(container, [new File(["corrupt"], `${name}.woff2`)]);
    await screen.findByRole("alert");
    expect(set).not.toHaveBeenCalled();
    expect(await readCustomFonts()).toEqual({});
  },
);

it("passes the entire decoded font binary, including non-ASCII bytes", async () => {
  const bytes = [0, 255, 128, 13, 10, 65];
  await validateFontData(btoa(String.fromCharCode(...bytes)));
  expect([...decoded[0]]).toEqual(bytes);
});

it.each(["valid", "invalid"])(
  "ignores a late %s result for a replaced font while checking its new bytes",
  async (olderStatus) => {
    let resolveOlder!: () => void;
    let rejectOlder!: (error: Error) => void;
    const older = new Promise<void>((resolve, reject) => {
      resolveOlder = resolve;
      rejectOlder = reject;
    });
    let resolveReplacement!: () => void;
    const replacement = new Promise<void>((resolve) => {
      resolveReplacement = resolve;
    });
    let replacementLoads = 0;
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(
          _family: string,
          private bytes: Uint8Array,
        ) {}
        load() {
          if (String.fromCharCode(...this.bytes) === "older") return older;
          // Upload validation succeeds, then the independent Library check waits.
          return ++replacementLoads === 1 ? Promise.resolve() : replacement;
        }
      },
    );
    store[CUSTOM_FONTS_KEY] = {
      old: {
        id: "old",
        name: "Working",
        data: btoa("older"),
        format: "woff2",
        mimeType: "font/woff2",
      },
    };
    const { container } = render(<CustomFontManager />);
    await screen.findByText(/Checking font decoding/);
    upload(container, [new File(["replacement"], "Working.woff2")]);
    await screen.findByRole("status");
    await waitFor(() => expect(replacementLoads).toBe(2));
    await act(async () => {
      if (olderStatus === "valid") resolveOlder();
      else rejectOlder(new Error("old bytes failed"));
    });
    expect(screen.getByText(/Checking font decoding/)).toBeTruthy();
    expect(screen.queryByText(/decoded successfully/)).toBeNull();
    expect(screen.queryByText(/Cannot decode this font/)).toBeNull();
    await act(async () => resolveReplacement());
    await screen.findByText(/decoded successfully/);
    expect((await readCustomFonts()).old.data).toBe(btoa("replacement"));
    expect(Object.keys(await readCustomFonts())).toEqual(["old"]);
  },
);
