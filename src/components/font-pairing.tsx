import { useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FontStatusDot } from "@/components/font-status-dot";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BUILTIN_SANS_FONT_NAMES } from "@/shared/builtin-fonts";
import {
  addFontToStack,
  distinctFontNames,
  normalizeFontName,
  removeFontFromStack,
  replaceFontInStack,
  moveFontInStack,
} from "@/shared/font-stack";
import { useI18n } from "@/shared/i18n/use-i18n";

type FontPairingProps = {
  fontStack: string[];
  savedFontNames?: string[];
  uploadedFontNames: string[];
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: string[]) => void | Promise<void>;
};

export function FontPairing({
  fontStack,
  savedFontNames,
  uploadedFontNames,
  disabled = false,
  busy = false,
  onChange,
}: FontPairingProps) {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const instructionsId = useId();
  const [reorder, setReorder] = useState<{
    stack: string[];
    from: number;
    to: number;
    mode: "drag" | "keyboard";
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const savingOrderRef = useRef(false);
  // A changed stack or disabled state invalidates an in-progress gesture.
  // Never apply an index from an older stack to newly hydrated data.
  const active =
    !disabled && !busy && reorder?.stack === fontStack ? reorder : null;
  if (reorder && !active) {
    setReorder(null);
    setAnnouncement("");
  }
  const reorderDisabled = disabled || busy || savingOrder;
  const editingDisabled = disabled || savingOrder || !!active;
  const shownStack =
    active?.mode === "keyboard"
      ? moveFontInStack(fontStack, active.from, active.to)
      : fontStack;

  function cancelReorder() {
    setReorder(null);
    setAnnouncement(t("popup.reorderCancelled"));
  }

  function startReorder(index: number, mode: "drag" | "keyboard") {
    if (reorderDisabled || savingOrderRef.current || fontStack.length < 2)
      return;
    closePicker();
    setReorder({ stack: fontStack, from: index, to: index, mode });
    setAnnouncement(
      t("popup.reorderPosition", {
        font: fontStack[index],
        position: index + 1,
        count: fontStack.length,
      }),
    );
  }

  async function finishReorder(to: number) {
    if (!active || reorderDisabled || savingOrderRef.current) return;
    const next = moveFontInStack(fontStack, active.from, to);
    setReorder(null);
    setAnnouncement("");
    if (next === fontStack) return;
    savingOrderRef.current = true;
    setSavingOrder(true);
    try {
      // The parent owns optimistic preview, shared storage and rollback.
      await onChange(next);
    } catch {
      setAnnouncement(t("popup.saveError"));
    } finally {
      savingOrderRef.current = false;
      setSavingOrder(false);
    }
  }
  const options = useMemo(
    () => [
      {
        heading: t("popup.savedFonts"),
        fonts: distinctFontNames(
          [...fontStack, ...(savedFontNames ?? [])],
          [...BUILTIN_SANS_FONT_NAMES, ...uploadedFontNames],
        ),
        showInUse: true,
      },
      {
        heading: t("popup.bundledFonts"),
        fonts: BUILTIN_SANS_FONT_NAMES,
      },
      {
        heading: t("popup.uploadedFonts"),
        fonts: uploadedFontNames.filter(
          (font) =>
            !BUILTIN_SANS_FONT_NAMES.some(
              (builtin) =>
                builtin.toLocaleLowerCase() === font.toLocaleLowerCase(),
            ),
        ),
      },
    ],
    [t, fontStack, savedFontNames, uploadedFontNames],
  );

  function closePicker() {
    setOpenIndex(null);
    setDraft("");
  }

  function chooseFont(value: string) {
    if (openIndex === null || editingDisabled) return;
    const next =
      openIndex === fontStack.length
        ? addFontToStack(fontStack, value)
        : replaceFontInStack(fontStack, openIndex, value);
    if (next !== fontStack) void onChange(next);
    closePicker();
  }

  function picker(index: number, trigger: React.ReactNode) {
    const query = draft.trim().toLocaleLowerCase();
    const inUse = new Set(
      fontStack
        .filter((_, savedIndex) => savedIndex !== index)
        .map((font) => font.toLocaleLowerCase()),
    );
    const typedFont = normalizeFontName(draft);
    const groups = options.map((group) => ({
      ...group,
      fonts: group.fonts.filter(
        (font) =>
          (!query || font.toLocaleLowerCase().includes(query)) &&
          (group.showInUse || !inUse.has(font.toLocaleLowerCase())),
      ),
    }));
    return (
      <Popover
        open={openIndex === index}
        onOpenChange={(open) => {
          if (open) {
            setOpenIndex(index);
            setDraft("");
          } else if (openIndex === index) {
            closePicker();
          }
        }}
      >
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          className="w-[340px] max-w-[calc(420px-2rem)] p-[7px]"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          usePortal={false}
        >
          <Command shouldFilter={false}>
            <CommandInput
              autoFocus
              placeholder={t("popup.searchOrTypeFont")}
              aria-label={t("popup.searchOrTypeFont")}
              value={draft}
              onValueChange={setDraft}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  typedFont &&
                  !inUse.has(typedFont.toLocaleLowerCase()) &&
                  !groups.some((group) =>
                    group.fonts.some(
                      (font) => !inUse.has(font.toLocaleLowerCase()),
                    ),
                  )
                ) {
                  event.preventDefault();
                  chooseFont(typedFont);
                }
              }}
            />
            <CommandList className="max-h-[220px]">
              <CommandEmpty>{t("popup.pressEnterSave")}</CommandEmpty>
              {groups.map((group) => {
                const fonts = group.fonts;
                return fonts.length ? (
                  <CommandGroup key={group.heading} heading={group.heading}>
                    {fonts.map((font) => (
                      <CommandItem
                        key={font}
                        value={font}
                        disabled={inUse.has(font.toLocaleLowerCase())}
                        onSelect={() => chooseFont(font)}
                      >
                        <span className="min-w-0 flex-1 truncate">{font}</span>
                        <FontStatusDot
                          name={font}
                          uploadedNames={uploadedFontNames}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null;
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-2">
      <p id={instructionsId} className="sr-only">
        {t("popup.reorderInstructions")}
      </p>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {fontStack.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {t("popup.noTextFonts")}
          </div>
        ) : (
          shownStack.map((font, index) => {
            const label =
              index === 0
                ? t("popup.primaryFont")
                : index === 1
                  ? t("popup.secondaryFont")
                  : t("popup.fallbackFont", { number: index + 1 });
            return (
              <div
                key={font}
                data-font-row={font}
                className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0 ${active?.to === index ? "bg-accent ring-2 ring-inset ring-primary" : ""}`}
                onDragOver={(event) => {
                  if (!active || active.mode !== "drag") return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (active.to !== index) setReorder({ ...active, to: index });
                }}
                onDrop={(event) => {
                  if (!active || active.mode !== "drag") return;
                  event.preventDefault();
                  void finishReorder(index);
                }}
              >
                <span
                  className="text-xs tabular-nums text-muted-foreground"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {picker(
                  index,
                  <button
                    type="button"
                    className="min-w-0 rounded-sm text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                    disabled={editingDisabled}
                    aria-label={t("popup.replaceFont", { label, font })}
                  >
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {label}
                    </span>
                    <span
                      className="block truncate text-base font-semibold leading-tight"
                      title={font}
                    >
                      {font}
                    </span>
                  </button>,
                )}
                <span
                  className="w-16 truncate text-end text-xl"
                  dir="auto"
                  aria-hidden="true"
                  style={{
                    fontFamily: `'${font.replace(/'/g, "\\'")}', sans-serif`,
                  }}
                >
                  Aa
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="me-1 flex h-7 w-3 shrink-0 items-center justify-center">
                    <FontStatusDot
                      name={font}
                      uploadedNames={uploadedFontNames}
                    />
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={editingDisabled}
                    aria-label={t("popup.removeFont", { label, font })}
                    onClick={() =>
                      void onChange(removeFontFromStack(fontStack, index))
                    }
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    disabled={disabled || fontStack.length < 2}
                    aria-disabled={reorderDisabled || fontStack.length < 2}
                    draggable={!reorderDisabled && fontStack.length > 1}
                    aria-label={t("popup.reorderFont", { font })}
                    aria-describedby={instructionsId}
                    aria-pressed={!!active && font === fontStack[active.from]}
                    title={t("popup.reorderInstructions")}
                    onDragStart={(event) => {
                      if (reorderDisabled || savingOrderRef.current) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", font);
                      startReorder(index, "drag");
                    }}
                    onDragEnd={() => {
                      setReorder(null);
                      setAnnouncement("");
                    }}
                    onClick={() => {
                      if (reorderDisabled) return;
                      if (active?.mode === "keyboard")
                        void finishReorder(active.to);
                      else startReorder(index, "keyboard");
                    }}
                    onBlur={() => {
                      if (active?.mode === "keyboard") cancelReorder();
                    }}
                    onKeyDown={(event) => {
                      if (reorderDisabled) return;
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        if (active?.mode === "keyboard")
                          void finishReorder(active.to);
                        else startReorder(index, "keyboard");
                        return;
                      }
                      if (event.key === "Escape" && active) {
                        event.preventDefault();
                        cancelReorder();
                      }
                      if (active?.mode !== "keyboard") return;
                      const to =
                        event.key === "ArrowUp"
                          ? Math.max(0, active.to - 1)
                          : event.key === "ArrowDown"
                            ? Math.min(fontStack.length - 1, active.to + 1)
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? fontStack.length - 1
                                : null;
                      if (to === null) return;
                      event.preventDefault();
                      setReorder({ ...active, to });
                      setAnnouncement(
                        t("popup.reorderPosition", {
                          font: fontStack[active.from],
                          position: to + 1,
                          count: fontStack.length,
                        }),
                      );
                    }}
                  >
                    <ChevronsUpDown
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {picker(
        fontStack.length,
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ms-auto flex h-7 gap-1 px-1.5 text-xs text-primary hover:text-primary"
          disabled={editingDisabled}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("popup.addFallback")}
        </Button>,
      )}
    </div>
  );
}
