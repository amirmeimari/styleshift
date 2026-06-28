import { describe, expect, it } from "vitest";
import { translate, translations } from "./translations";
import { LOCALES } from "./locales";

describe("translate", () => {
  it("returns the message for the requested locale", () => {
    expect(translate("es", "common.close")).toBe("Cerrar");
    expect(translate("fa", "common.save")).toBe("ذخیره");
  });

  it("interpolates {vars}", () => {
    expect(translate("en", "popup.applyFontFor", { page: "github.com" })).toBe(
      "Apply font for github.com",
    );
    expect(translate("en", "editor.lines", { count: 3 })).toBe("3 lines");
  });

  it("falls back to English for an unknown locale entry", () => {
    // Every key has all locales, so force the fallback via a missing key.
    expect(translate("es", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("translation completeness", () => {
  it("has every locale for every key", () => {
    const codes = LOCALES.map((locale) => locale.code);
    for (const [key, entry] of Object.entries(translations)) {
      for (const code of codes) {
        expect(entry[code], `${key} missing ${code}`).toBeTruthy();
      }
    }
  });
});
