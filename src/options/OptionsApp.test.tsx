import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OptionsApp } from "./OptionsApp";
import { createChromeStub } from "@/shared/test-chrome";
import { DEFAULT_SETTINGS, TYPOGRAPHY_KEY } from "@/shared/style-core";
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
vi.mock("@/css-editor/css-editor", () => ({
  CssEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

let store: Record<string, unknown>;
beforeEach(() => {
  store = {
    "example.com": {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      cssEnabled: true,
      customCSS: "body { color: red; }",
    },
  };
  vi.stubGlobal("chrome", createChromeStub(store));
  window.history.replaceState({}, "", "/options.html?host=example.com");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("options editor state boundaries", () => {
  it("does not apply a completed save response to a different site's editor", async () => {
    store["other.example"] = { ...DEFAULT_SETTINGS, customCSS: "other CSS" };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OptionsApp />);
    const editor = await screen.findByRole("textbox", {
      name: "This site: example.com",
    });
    const originalSet = chrome.storage.local.set;
    let release: (() => void) | undefined;
    vi.spyOn(chrome.storage.local, "set").mockImplementation(async (items) => {
      if ("example.com" in items)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await originalSet(items);
    });
    fireEvent.change(editor, { target: { value: "saved first site CSS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(release).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Edit other.example" }));
    await screen.findByRole("textbox", { name: "This site: other.example" });
    release!();
    await waitFor(() =>
      expect((store["example.com"] as typeof DEFAULT_SETTINGS).customCSS).toBe(
        "saved first site CSS",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Reset" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("reports a rejected master switch write and keeps the stored state", async () => {
    window.history.replaceState({}, "", "/options.html?view=settings");
    render(<OptionsApp />);
    const toggle = await screen.findByRole("switch", {
      name: "Enable StyleShift",
    });
    vi.spyOn(chrome.storage.local, "set").mockRejectedValueOnce(
      new Error("storage failed"),
    );
    fireEvent.click(toggle);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not save the change. Try again.",
    );
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("saves only CSS after a site switch changes while the editor is open", async () => {
    render(<OptionsApp />);
    const editor = await screen.findByRole("textbox", {
      name: "This site: example.com",
    });
    const toggle = await screen.findByRole("switch", {
      name: "Fonts: example.com",
    });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        (store["example.com"] as typeof DEFAULT_SETTINGS).fontEnabled,
      ).toBe(false),
    );
    fireEvent.change(editor, { target: { value: "body { color: blue; }" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect((store["example.com"] as typeof DEFAULT_SETTINGS).customCSS).toBe(
        "body { color: blue; }",
      ),
    );
    expect((store["example.com"] as typeof DEFAULT_SETTINGS).fontEnabled).toBe(
      false,
    );
  });

  it("removes CSS without restoring an older subdomain setting", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OptionsApp />);
    await screen.findByRole("textbox", { name: "This site: example.com" });
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Subdomains" }),
    );
    await waitFor(() =>
      expect(
        (store["example.com"] as typeof DEFAULT_SETTINGS).includeSubdomains,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove CSS" }));
    await waitFor(() =>
      expect((store["example.com"] as typeof DEFAULT_SETTINGS).customCSS).toBe(
        "",
      ),
    );
    expect(
      (store["example.com"] as typeof DEFAULT_SETTINGS).includeSubdomains,
    ).toBe(false);
  });

  it("asks before importing over drafts and reloads the accepted backup into the editor", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<OptionsApp />);
    const editor = await screen.findByRole("textbox", {
      name: "This site: example.com",
    });
    fireEvent.change(editor, { target: { value: "unsaved CSS" } });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const file = {
      text: async () =>
        JSON.stringify({
          format: "styleshift-backup",
          version: 1,
          exportedAt: "2026-11-01T00:00:00.000Z",
          globals: {},
          sites: {
            "example.com": { ...DEFAULT_SETTINGS, customCSS: "imported CSS" },
          },
        }),
    };
    const input = document.querySelector(
      'input[type="file"][accept=".json,application/json"]',
    )!;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "Import" }));
    expect(confirm).toHaveBeenCalled();
    expect((store["example.com"] as typeof DEFAULT_SETTINGS).customCSS).toBe(
      "body { color: red; }",
    );
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect((store["example.com"] as typeof DEFAULT_SETTINGS).customCSS).toBe(
        "imported CSS",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sites" }));
    expect(
      (
        (await screen.findByRole("textbox", {
          name: "This site: example.com",
        })) as HTMLTextAreaElement
      ).value,
    ).toBe("imported CSS");
    expect(store[TYPOGRAPHY_KEY]).toBeUndefined();
  });
});
