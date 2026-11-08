import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "./App";
import { createChromeStub } from "@/shared/test-chrome";
import { DEFAULT_SETTINGS, GLOBAL_FONT_STACK_KEY } from "@/shared/style-core";
import { translate } from "@/shared/i18n/translations";
import { localeDir, type LocaleCode } from "@/shared/i18n/locales";

const previewSettings = vi.hoisted(() => ({
  locale: "en" as LocaleCode,
  theme: "light" as "light" | "dark",
}));

vi.mock("@/shared/i18n/use-i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      translate(previewSettings.locale, key, vars),
    dir: localeDir(previewSettings.locale),
    locale: previewSettings.locale,
    setLocale: vi.fn(),
  }),
}));
vi.mock("@/shared/theme-provider", () => ({
  useTheme: () => ({ theme: previewSettings.theme, setTheme: vi.fn() }),
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
  previewSettings.locale = "en";
  previewSettings.theme = "light";
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  store = {
    [GLOBAL_FONT_STACK_KEY]: ["Inter"],
    "example.com": {
      ...DEFAULT_SETTINGS,
      fontEnabled: true,
      cssEnabled: false,
      customCSS: "parent CSS",
    },
  };
  vi.stubGlobal("chrome", {
    ...createChromeStub(store),
    tabs: {
      query: async () => [{ id: 1, url: "https://child.example.com/" }],
      sendMessage: async () => {},
    },
  });
  Element.prototype.scrollTo = vi.fn();
});

it.each(
  (["en", "fa", "ar"] as const).flatMap((locale) =>
    (["light", "dark"] as const).map((theme) => ({ locale, theme })),
  ),
)(
  "keeps the editable preview and ordered fonts across both Fonts views in $theme $locale",
  async ({ locale, theme }) => {
    previewSettings.locale = locale;
    previewSettings.theme = theme;
    store[GLOBAL_FONT_STACK_KEY] = ["Inter", "Vazirmatn", "Exact Local Family"];
    const originalStore = structuredClone(store);
    render(<App />);
    await screen.findByText("child.example.com");

    const expectPreview = (value: string) => {
      const preview = screen.getByRole<HTMLTextAreaElement>("textbox", {
        name: translate(locale, "popup.preview"),
      });
      expect(preview.value).toBe(value);
      expect(preview.closest("main")?.dir).toBe(localeDir(locale));
      expect(preview.dir).toBe("auto");
      expect(preview.classList.contains("text-start")).toBe(true);
      expect(preview.style.fontFamily).toBe(
        'Inter, Vazirmatn, "Exact Local Family"',
      );
      return preview;
    };
    const preview = expectPreview("The web, your way.");
    const sample = "سلام دنیا\n你好，世界！\nHello, world.";
    fireEvent.change(preview, { target: { value: sample } });
    expectPreview(sample);
    const rowSamples = screen.getAllByText("Aa");
    expect(rowSamples).toHaveLength(3);
    for (const specimen of rowSamples) {
      expect(specimen.dir).toBe("auto");
      expect(specimen.getAttribute("aria-hidden")).toBe("true");
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`^${translate(locale, "popup.typography")}`),
      }),
    );
    expectPreview(sample);
    expect(store).toEqual(originalStore);
  },
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("refreshes inherited CSS state after creating a clean child font override", async () => {
  render(<App />);
  await screen.findByText("child.example.com");
  fireEvent.click(screen.getByRole("switch", { name: "Site fonts" }));
  await waitFor(() => expect(store["child.example.com"]).toBeDefined());
  fireEvent.click(screen.getByRole("tab", { name: "CSS" }));
  const editor = await screen.findByRole("textbox", { name: "This site" });
  expect((editor as HTMLTextAreaElement).value).toBe("");
  expect(
    screen
      .getByRole("switch", { name: "Apply site CSS" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

it("keeps site enablement independent of a delayed shared font autosave", async () => {
  store["child.example.com"] = { ...DEFAULT_SETTINGS, fontEnabled: true };
  const originalSet = chrome.storage.local.set;
  let release: (() => void) | undefined;
  vi.spyOn(chrome.storage.local, "set").mockImplementation(async (items) => {
    if (GLOBAL_FONT_STACK_KEY in items)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await originalSet(items);
  });
  render(<App />);
  await screen.findByText("child.example.com");
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Primary: Inter" }),
  );
  fireEvent.click(screen.getByRole("switch", { name: "Site fonts" }));
  await waitFor(() =>
    expect(
      (store["child.example.com"] as typeof DEFAULT_SETTINGS).fontEnabled,
    ).toBe(false),
  );
  release!();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("Saved automatically"),
  );
  expect(
    (store["child.example.com"] as typeof DEFAULT_SETTINGS).fontEnabled,
  ).toBe(false);
});

it("rolls back a rejected site toggle and exposes a visible error", async () => {
  render(<App />);
  await screen.findByText("child.example.com");
  vi.spyOn(chrome.storage.local, "set").mockRejectedValueOnce(
    new Error("storage failed"),
  );
  fireEvent.click(screen.getByRole("switch", { name: "Site fonts" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not save the change. Try again.",
  );
  expect(
    screen
      .getByRole("switch", { name: "Site fonts" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(store["child.example.com"]).toBeUndefined();
});

it("blocks editing when initial storage hydration fails", async () => {
  vi.spyOn(chrome.storage.local, "get").mockRejectedValue(
    new Error("storage failed"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not load settings",
  );
  expect(screen.queryByRole("switch")).toBeNull();
});

it("restores the persisted stack when two rapid autosaves both fail", async () => {
  store[GLOBAL_FONT_STACK_KEY] = ["Inter", "Roboto"];
  render(<App />);
  await screen.findByText("child.example.com");
  vi.spyOn(chrome.storage.local, "set").mockRejectedValue(
    new Error("storage failed"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Primary: Inter" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Primary: Roboto" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Replace Primary: Inter" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Replace Secondary: Roboto" }),
  ).toBeTruthy();
});

it.each([
  { host: "child.example.com", preset: false },
  { host: "github.com", preset: true },
  { host: "www.github.com", preset: true },
])(
  "preserves legacy font fields when toggling $host (preset=$preset)",
  async ({ host, preset }) => {
    const legacy = {
      ...DEFAULT_SETTINGS,
      fontFamily: "Lato",
      monoFontFamily: "Roboto",
      fontEnabled: true,
    };
    store[host] = { ...legacy };
    store["github.com"] = { ...legacy };
    vi.stubGlobal("chrome", {
      ...createChromeStub(store),
      tabs: {
        query: async () => [{ id: 1, url: `https://${host}/` }],
        sendMessage: async () => {},
      },
    });
    render(<App />);
    await screen.findByText(host);
    fireEvent.click(
      preset
        ? screen.getByRole("button", { name: "GitHub" })
        : screen.getByRole("switch", { name: "Site fonts" }),
    );
    await waitFor(() =>
      expect((store[host] as typeof DEFAULT_SETTINGS).fontEnabled).toBe(false),
    );
    expect(store[host]).toEqual({ ...legacy, fontEnabled: false });
    if (preset)
      expect(store["github.com"]).toEqual({ ...legacy, fontEnabled: false });
    expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Inter"]);
  },
);

function reorderInter() {
  const handle = screen.getByRole("button", { name: "Reorder Inter" });
  fireEvent.keyDown(handle, { key: " " });
  fireEvent.keyDown(handle, { key: "End" });
  fireEvent.keyDown(handle, { key: "Enter" });
}

it.each(["keyboard", "drag"])(
  "persists a %s reordered shared stack, updates roles/preview, and hydrates that order after reopening",
  async (input) => {
    store[GLOBAL_FONT_STACK_KEY] = ["Inter", "Vazirmatn", "Exact Local Family"];
    const initialSite = structuredClone(store["example.com"]);
    const { unmount } = render(<App />);
    await screen.findByText("child.example.com");
    if (input === "keyboard") reorderInter();
    else {
      const dataTransfer = { setData: vi.fn() };
      fireEvent.dragStart(
        screen.getByRole("button", { name: "Reorder Inter" }),
        { dataTransfer },
      );
      fireEvent.drop(
        screen
          .getByRole("button", { name: "Reorder Exact Local Family" })
          .closest("[data-font-row]")!,
        { dataTransfer },
      );
    }
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Saved automatically",
      ),
    );
    expect(store[GLOBAL_FONT_STACK_KEY]).toEqual([
      "Vazirmatn",
      "Exact Local Family",
      "Inter",
    ]);
    expect(store["example.com"]).toEqual(initialSite);
    expect(store["child.example.com"]).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "Replace Primary: Vazirmatn" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Replace Secondary: Exact Local Family",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Replace Fallback 3: Inter" }),
    ).toBeTruthy();
    expect(
      screen.getByDisplayValue("The web, your way.").style.fontFamily,
    ).toBe('Vazirmatn, "Exact Local Family", Inter');
    unmount();
    render(<App />);
    await screen.findByRole("button", { name: "Replace Primary: Vazirmatn" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Secondary: Exact Local Family",
      }),
    );
    await waitFor(() =>
      expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Vazirmatn", "Inter"]),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Replace Secondary: Inter" }),
    );
    expect(
      await screen.findByPlaceholderText("Search or type a font name"),
    ).toBeTruthy();
  },
);

it("rolls back the exact saved stack and preview on a rejected reorder, then permits retry", async () => {
  store[GLOBAL_FONT_STACK_KEY] = ["Inter", "Vazirmatn"];
  render(<App />);
  await screen.findByText("child.example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(chrome.storage.local, "set").mockRejectedValueOnce(
    new Error("storage failed"),
  );
  reorderInter();
  expect((await screen.findByRole("alert")).textContent).toBe(
    translate("en", "popup.saveError"),
  );
  expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Inter", "Vazirmatn"]);
  expect(
    screen.getByRole("button", { name: "Replace Primary: Inter" }),
  ).toBeTruthy();
  expect(screen.getByDisplayValue("The web, your way.").style.fontFamily).toBe(
    "Inter, Vazirmatn",
  );
  reorderInter();
  await waitFor(() =>
    expect(store[GLOBAL_FONT_STACK_KEY]).toEqual(["Vazirmatn", "Inter"]),
  );
});
