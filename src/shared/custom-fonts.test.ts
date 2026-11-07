import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createChromeStub } from "./test-chrome";
import {
  CUSTOM_FONTS_KEY,
  CUSTOM_FONT_INDEX_KEY,
  type CustomFont,
} from "./style-core";
import {
  deleteCustomFont,
  readCustomFonts,
  updateCustomFont,
} from "./custom-fonts";

const font: CustomFont = {
  id: "one",
  name: "My Font",
  format: "woff2",
  mimeType: "font/woff2",
  data: "ORIGINAL",
};
let store: Record<string, unknown>;
beforeEach(() => {
  store = {};
  vi.stubGlobal("chrome", createChromeStub(store));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the old uploaded font readable when a replacement write fails", async () => {
  await updateCustomFont(font);
  vi.spyOn(chrome.storage.local, "set").mockRejectedValueOnce(
    new Error("storage unavailable"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(
    updateCustomFont({ ...font, data: "REPLACEMENT" }),
  ).rejects.toThrow("storage unavailable");
  expect((await readCustomFonts()).one.data).toBe("ORIGINAL");
});

it("preserves other legacy fonts when the first chunked upload is saved", async () => {
  store[CUSTOM_FONTS_KEY] = { one: font };
  await updateCustomFont({
    ...font,
    id: "two",
    name: "Another Font",
    data: "NEW",
  });
  expect(Object.keys(await readCustomFonts()).sort()).toEqual(["one", "two"]);
  expect(store[CUSTOM_FONT_INDEX_KEY]).toBeDefined();
});

it("deletes a font stored in a legacy backup without resurrecting it", async () => {
  store[CUSTOM_FONTS_KEY] = { one: font };
  await deleteCustomFont("one");
  expect(await readCustomFonts()).toEqual({});
});
