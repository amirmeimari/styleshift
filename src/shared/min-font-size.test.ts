import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMinimumFontSize } from "./min-font-size";

function stubChrome(overrides: {
  setMinimumFontSize?: (options: { pixelSize: number }) => Promise<void>;
  clearMinimumFontSize?: () => Promise<void>;
  withFontSettings?: boolean;
}) {
  const {
    setMinimumFontSize = async () => {},
    clearMinimumFontSize = async () => {},
    withFontSettings = true,
  } = overrides;

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: withFontSettings
      ? { fontSettings: { setMinimumFontSize, clearMinimumFontSize } }
      : {},
  });
}

describe("applyMinimumFontSize", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when chrome.fontSettings is unavailable", async () => {
    stubChrome({ withFontSettings: false });
    await expect(applyMinimumFontSize(16)).resolves.toBeUndefined();
  });

  it("sets the pixel size when a value is given", async () => {
    const setMinimumFontSize = vi.fn(async () => {});
    stubChrome({ setMinimumFontSize });
    await applyMinimumFontSize(16);
    expect(setMinimumFontSize).toHaveBeenCalledWith({ pixelSize: 16 });
  });

  it("clears the preference when the value is null", async () => {
    const clearMinimumFontSize = vi.fn(async () => {});
    stubChrome({ clearMinimumFontSize });
    await applyMinimumFontSize(null);
    expect(clearMinimumFontSize).toHaveBeenCalledWith({});
  });
});
