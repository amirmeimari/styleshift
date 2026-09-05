import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMinimumFontSize,
  hasFontSettingsPermission,
  requestFontSettingsPermission,
  revokeFontSettingsPermission,
} from "./min-font-size";

function stubChrome(overrides: {
  contains?: () => Promise<boolean>;
  request?: () => Promise<boolean>;
  remove?: () => Promise<boolean>;
  setMinimumFontSize?: (options: { pixelSize: number }) => Promise<void>;
  clearMinimumFontSize?: () => Promise<void>;
  withFontSettings?: boolean;
}) {
  const {
    contains = async () => false,
    request = async () => false,
    remove = async () => true,
    setMinimumFontSize = async () => {},
    clearMinimumFontSize = async () => {},
    withFontSettings = true,
  } = overrides;

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      permissions: { contains, request, remove },
      ...(withFontSettings
        ? { fontSettings: { setMinimumFontSize, clearMinimumFontSize } }
        : {}),
    },
  });
}

describe("min-font-size", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasFontSettingsPermission", () => {
    it("returns what chrome.permissions.contains reports", async () => {
      stubChrome({ contains: async () => true });
      expect(await hasFontSettingsPermission()).toBe(true);
    });

    it("degrades to false when chrome.permissions is unavailable", async () => {
      Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        value: {},
      });
      expect(await hasFontSettingsPermission()).toBe(false);
    });
  });

  describe("requestFontSettingsPermission", () => {
    it("returns what chrome.permissions.request reports", async () => {
      stubChrome({ request: async () => true });
      expect(await requestFontSettingsPermission()).toBe(true);
    });

    it("degrades to false when the API throws (e.g. denied by policy)", async () => {
      stubChrome({
        request: async () => {
          throw new Error("denied");
        },
      });
      expect(await requestFontSettingsPermission()).toBe(false);
    });
  });

  describe("revokeFontSettingsPermission", () => {
    it("never throws even when chrome.permissions is unavailable", async () => {
      Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        value: {},
      });
      await expect(revokeFontSettingsPermission()).resolves.toBeUndefined();
    });
  });

  describe("applyMinimumFontSize", () => {
    it("does nothing without the permission", async () => {
      const setMinimumFontSize = vi.fn(async () => {});
      stubChrome({ contains: async () => false, setMinimumFontSize });
      await applyMinimumFontSize(16);
      expect(setMinimumFontSize).not.toHaveBeenCalled();
    });

    it("does nothing when chrome.fontSettings is unavailable", async () => {
      stubChrome({ contains: async () => true, withFontSettings: false });
      await expect(applyMinimumFontSize(16)).resolves.toBeUndefined();
    });

    it("sets the pixel size when granted and a value is given", async () => {
      const setMinimumFontSize = vi.fn(async () => {});
      stubChrome({ contains: async () => true, setMinimumFontSize });
      await applyMinimumFontSize(16);
      expect(setMinimumFontSize).toHaveBeenCalledWith({ pixelSize: 16 });
    });

    it("clears the preference when the value is null", async () => {
      const clearMinimumFontSize = vi.fn(async () => {});
      stubChrome({ contains: async () => true, clearMinimumFontSize });
      await applyMinimumFontSize(null);
      expect(clearMinimumFontSize).toHaveBeenCalledWith({});
    });
  });
});
