import { describe, expect, it } from "vitest";
import {
  addFontToStack,
  removeFontFromStack,
  replaceFontInStack,
} from "./font-stack";

describe("ordered font stack edits", () => {
  it("appends a fallback without changing the existing order", () => {
    expect(addFontToStack(["Inter", "Vazirmatn"], "  Noto Sans  ")).toEqual([
      "Inter",
      "Vazirmatn",
      "Noto Sans",
    ]);
  });

  it("replaces a slot in place", () => {
    expect(
      replaceFontInStack(["Inter", "Vazirmatn", "serif"], 1, "Noto Sans"),
    ).toEqual(["Inter", "Noto Sans", "serif"]);
  });

  it("removes a slot and promotes later fallbacks", () => {
    expect(removeFontFromStack(["Inter", "Vazirmatn", "serif"], 0)).toEqual([
      "Vazirmatn",
      "serif",
    ]);
  });

  it("rejects empty, comma-bearing and duplicate family entries", () => {
    expect(addFontToStack(["Inter"], " , ")).toEqual(["Inter"]);
    expect(addFontToStack(["Inter"], "inter")).toEqual(["Inter"]);
    expect(replaceFontInStack(["Inter", "Vazirmatn"], 1, "INTER")).toEqual([
      "Inter",
      "Vazirmatn",
    ]);
  });
});
