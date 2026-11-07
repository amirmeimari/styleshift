import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveTab } from "./tabs";

function stubActiveTab(url: string) {
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 7, url }]),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getActiveTab", () => {
  it("returns an injectable active tab by default", async () => {
    stubActiveTab("https://example.com/article");

    await expect(getActiveTab()).resolves.toMatchObject({ id: 7 });
  });

  it("rejects restricted pages for callers that intend to inject", async () => {
    stubActiveTab("chrome://settings/");

    await expect(getActiveTab()).rejects.toThrow(
      "StyleShift is not available on this page.",
    );
  });

  it("lets the popup hydrate global controls on a restricted page", async () => {
    stubActiveTab("chrome://settings/");

    await expect(
      getActiveTab({ allowRestricted: true }),
    ).resolves.toMatchObject({ id: 7, url: "chrome://settings/" });
  });
});
