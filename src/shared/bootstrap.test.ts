import { afterEach, expect, it, vi } from "vitest";
import { bootstrapThemeAndLocale } from "./bootstrap";
import { LOCALE_STORAGE_KEY } from "./i18n/locales";
import { createChromeStub } from "./test-chrome";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

it.each([
  { browser: "fr-CA", expected: "fr", dir: "ltr" },
  { browser: "es-419", expected: "es", dir: "ltr" },
  { browser: "ar", expected: "ar", dir: "rtl" },
  { browser: "pt_BR", expected: "pt-BR", dir: "ltr" },
  { browser: "pt-PT", expected: "en", dir: "ltr" },
  { browser: "zh-CN", expected: "zh", dir: "ltr" },
  { browser: "zh-TW", expected: "zh-TW", dir: "ltr" },
  { browser: "zh-Hant-HK", expected: "zh-TW", dir: "ltr" },
  { browser: "it", expected: "en", dir: "ltr" },
  { browser: undefined, expected: "en", dir: "ltr" },
])("uses $expected for Chrome language $browser", async (testCase) => {
  const { browser, expected, dir } = testCase;
  const store = {};
  vi.stubGlobal("chrome", {
    ...createChromeStub(store),
    i18n: browser ? { getUILanguage: () => browser } : undefined,
  });

  expect((await bootstrapThemeAndLocale()).locale).toBe(expected);
  expect(document.documentElement.lang).toBe(expected);
  expect(document.documentElement.dir).toBe(dir);
  expect(store).not.toHaveProperty(LOCALE_STORAGE_KEY);
});

it("keeps an explicit English preference when Chrome uses French", async () => {
  vi.stubGlobal("chrome", {
    ...createChromeStub({ [LOCALE_STORAGE_KEY]: "en" }),
    i18n: { getUILanguage: () => "fr" },
  });

  expect((await bootstrapThemeAndLocale()).locale).toBe("en");
});
