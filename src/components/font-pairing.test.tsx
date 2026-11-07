import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { FontPairing } from "./font-pairing";
import { FontStatusDot } from "./font-status-dot";
import { translate } from "@/shared/i18n/translations";

vi.mock("@/shared/i18n/use-i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      translate("en", key, vars),
  }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("uses the highlighted search result on Enter instead of saving the query", async () => {
  const onChange = vi.fn();
  render(
    <FontPairing fontStack={[]} uploadedFontNames={[]} onChange={onChange} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add fallback" }));
  const input = await screen.findByRole("combobox");
  fireEvent.change(input, { target: { value: "Rob" } });
  await screen.findByRole("option", { name: /Roboto/ });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith(["Roboto"]);
});

it("still accepts a custom family when search has no matching option", async () => {
  const onChange = vi.fn();
  render(
    <FontPairing fontStack={[]} uploadedFontNames={[]} onChange={onChange} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add fallback" }));
  const input = await screen.findByRole("combobox");
  fireEvent.change(input, { target: { value: "My Local Font" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith(["My Local Font"]);
});

it.each(["Inter", "JetBrains Mono", "Arial"])(
  "does not promise availability for an upload named %s",
  (name) => {
    render(<FontStatusDot name={name} uploadedNames={[name.toLowerCase()]} />);
    expect(
      screen.getByRole("img", { name: /decoding not verified here/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("img", { name: /always available/ })).toBeNull();
  },
);

const stack = ["Inter", "Vazirmatn", "A Long Local Font Family"];
function handle(font = "Inter") {
  return screen.getByRole("button", { name: `Reorder ${font}` });
}
function row(font: string) {
  return handle(font).closest("[data-font-row]")!;
}
function dragStart(font = "Inter") {
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(handle(font), { dataTransfer });
  return dataTransfer;
}
function pick(font = "Inter") {
  fireEvent.keyDown(handle(font), { key: " " });
}

it("drags only from the handle and inserts at the target without losing exact font names", async () => {
  const onChange = vi.fn();
  render(
    <FontPairing
      fontStack={stack}
      uploadedFontNames={[]}
      onChange={onChange}
    />,
  );
  expect(handle().getAttribute("draggable")).toBe("true");
  expect(
    screen
      .getByRole("button", { name: "Remove Primary: Inter" })
      .getAttribute("draggable"),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Replace Primary: Inter" })
      .getAttribute("draggable"),
  ).toBeNull();
  const dataTransfer = dragStart();
  expect(dataTransfer.effectAllowed).toBe("move");
  fireEvent.dragOver(row(stack[2]), { dataTransfer });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.drop(row(stack[2]), { dataTransfer });
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      stack[1],
      stack[2],
      stack[0],
    ]),
  );
  expect(stack).toEqual(["Inter", "Vazirmatn", "A Long Local Font Family"]);
});

it("previews keyboard roles, preserves handle focus, and saves only on confirmation", async () => {
  const onChange = vi.fn();
  render(
    <FontPairing
      fontStack={stack}
      uploadedFontNames={[]}
      onChange={onChange}
    />,
  );
  const button = handle();
  button.focus();
  pick();
  expect(button.getAttribute("aria-describedby")).toBeTruthy();
  expect(
    document.getElementById(button.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toContain("Escape cancels");
  fireEvent.keyDown(button, { key: "ArrowDown" });
  expect(
    screen.getByRole("button", { name: "Replace Secondary: Inter" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Replace Primary: Vazirmatn" }),
  ).toBeTruthy();
  expect(document.activeElement).toBe(button);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: "End" });
  expect(
    screen.getByRole("button", { name: "Replace Fallback 3: Inter" }),
  ).toBeTruthy();
  fireEvent.keyDown(button, { key: "Home" });
  fireEvent.keyDown(button, { key: "ArrowUp" });
  fireEvent.keyDown(button, { key: "ArrowDown" });
  fireEvent.keyDown(button, { key: "Enter" });
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      stack[1],
      stack[0],
      stack[2],
    ]),
  );
});

it.each([
  "escape",
  "blur",
  "dragend",
  "same-row",
  "external-drop",
  "unchanged-keyboard",
])("does not save a cancelled/no-op gesture: %s", (gesture) => {
  const onChange = vi.fn();
  render(
    <FontPairing
      fontStack={stack}
      uploadedFontNames={[]}
      onChange={onChange}
    />,
  );
  if (["escape", "blur", "unchanged-keyboard"].includes(gesture)) {
    pick();
    if (gesture !== "unchanged-keyboard")
      fireEvent.keyDown(handle(), { key: "End" });
    if (gesture === "escape") fireEvent.keyDown(handle(), { key: "Escape" });
    else if (gesture === "blur") fireEvent.blur(handle());
    else fireEvent.keyDown(handle(), { key: "Enter" });
  } else {
    const dataTransfer = gesture === "external-drop" ? {} : dragStart();
    if (gesture === "dragend") {
      fireEvent.dragOver(row(stack[2]), { dataTransfer });
      fireEvent.dragEnd(handle());
    }
    fireEvent.drop(row(stack[0]), { dataTransfer });
  }
  expect(onChange).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Replace Primary: Inter" }),
  ).toBeTruthy();
});

it.each(
  ["disabled", "busy", "changed-stack"].flatMap((change) =>
    ["drag", "keyboard"].map((mode) => ({ change, mode })),
  ),
)(
  "invalidates a pending $mode gesture and its announcement after $change",
  ({ change, mode }) => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FontPairing
        fontStack={stack}
        uploadedFontNames={[]}
        onChange={onChange}
      />,
    );
    const dataTransfer = mode === "drag" ? dragStart() : { setData: vi.fn() };
    if (mode === "keyboard") {
      pick();
      fireEvent.keyDown(handle(), { key: "End" });
    }
    expect(screen.getByText(/Inter: position/)).toBeTruthy();
    rerender(
      <FontPairing
        fontStack={change === "changed-stack" ? [...stack].reverse() : stack}
        uploadedFontNames={[]}
        onChange={onChange}
        disabled={change === "disabled"}
        busy={change === "busy"}
      />,
    );
    expect(screen.queryByText(/Inter: position/)).toBeNull();
    expect(handle().getAttribute("aria-pressed")).toBe("false");
    fireEvent.drop(row(stack[2]), { dataTransfer });
    rerender(
      <FontPairing
        fontStack={stack}
        uploadedFontNames={[]}
        onChange={onChange}
      />,
    );
    fireEvent.drop(row(stack[2]), { dataTransfer });
    expect(onChange).not.toHaveBeenCalled();
  },
);

it("blocks overlapping reorder saves, recovers from rejection and allows retry", async () => {
  let reject!: (error: Error) => void;
  const onChange = vi.fn().mockImplementationOnce(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  render(
    <FontPairing
      fontStack={stack}
      uploadedFontNames={[]}
      onChange={onChange}
    />,
  );
  pick();
  fireEvent.keyDown(handle(), { key: "End" });
  fireEvent.keyDown(handle(), { key: "Enter" });
  expect(handle().getAttribute("aria-disabled")).toBe("true");
  expect(handle().getAttribute("draggable")).toBe("false");
  pick();
  fireEvent.keyDown(handle(), { key: "End" });
  fireEvent.keyDown(handle(), { key: "Enter" });
  expect(onChange).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("storage failed")));
  expect(screen.getByText(/Could not save/)).toBeTruthy();
  pick();
  fireEvent.keyDown(handle(), { key: "ArrowDown" });
  fireEvent.keyDown(handle(), { key: " " });
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
});

it.each([{ disabled: true }, { busy: true }, { fontStack: ["Inter"] }])(
  "does not begin reordering when unavailable: %o",
  (props) => {
    const onChange = vi.fn();
    render(
      <FontPairing
        fontStack={stack}
        uploadedFontNames={[]}
        onChange={onChange}
        {...props}
      />,
    );
    pick();
    fireEvent.keyDown(handle(), { key: "ArrowDown" });
    fireEvent.keyDown(handle(), { key: "Enter" });
    fireEvent.dragStart(handle(), { dataTransfer: { setData: vi.fn() } });
    fireEvent.drop(row("Inter"), { dataTransfer: {} });
    expect(onChange).not.toHaveBeenCalled();
  },
);
