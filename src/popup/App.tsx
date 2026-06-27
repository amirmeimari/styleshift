import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, FileCode2, Moon, Sun, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpTooltip, LabelWithHelp } from "@/components/help";
import { useTheme } from "@/shared/use-theme";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { CustomFont, StyleShiftSettings } from "@/shared/styleshift";
import {
  DEFAULT_SETTINGS,
  POPULAR_SITE_PRESETS,
  getActiveTab,
  getHostname,
  hostMatchesPreset,
  parseFontStack,
  readCustomFonts,
  readGlobalEnabled,
  readGlobalFontStack,
  readGlobalMonoFontStack,
  readHostSettings,
  requestReinject,
  serializeFontStack,
  updateGlobalEnabled,
  updateGlobalFontStack,
  updateGlobalMonoFontStack,
  updateHostSettings,
} from "@/shared/styleshift";

export function App() {
  const [hostname, setHostname] = useState("");
  const [pageName, setPageName] = useState("this page");
  const [fontFamily, setFontFamily] = useState(DEFAULT_SETTINGS.fontFamily);
  const [fontStack, setFontStack] = useState<string[]>([]);
  const [fontDraft, setFontDraft] = useState("");
  const [monoFontFamily, setMonoFontFamily] = useState(
    DEFAULT_SETTINGS.monoFontFamily,
  );
  const [monoFontDraft, setMonoFontDraft] = useState("");
  const [fontEnabled, setFontEnabled] = useState(DEFAULT_SETTINGS.fontEnabled);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [fontComboboxOpen, setFontComboboxOpen] = useState(false);
  const [monoFontComboboxOpen, setMonoFontComboboxOpen] = useState(false);
  const [customFonts, setCustomFonts] = useState<Record<string, CustomFont>>(
    {},
  );
  const [presetStates, setPresetStates] = useState<Record<string, boolean>>({});
  const [failedPresetIcons, setFailedPresetIcons] = useState<
    Record<string, boolean>
  >({});
  const { theme, toggleTheme } = useTheme();
  const uploadedFontNames = useMemo(
    () => Object.values(customFonts).map((font) => font.name),
    [customFonts],
  );
  const presetColumns = useMemo(() => {
    const columnSizes = [3, 3, 3, 3, 3, 3, 3, 3, 3];
    let startIndex = 0;

    return columnSizes.map((columnSize) => {
      const column = POPULAR_SITE_PRESETS.slice(
        startIndex,
        startIndex + columnSize,
      );
      startIndex += columnSize;
      return column;
    });
  }, []);

  const canApply = useMemo(
    () => Boolean(hostname) && globalEnabled,
    [globalEnabled, hostname],
  );

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const tab = await getActiveTab();
        const host = getHostname(tab.url);

        if (!host) {
          return;
        }

        const [settings, enabled, globalFontStack, globalMonoFontStack, fonts] =
          await Promise.all([
            readHostSettings(host),
            readGlobalEnabled(),
            readGlobalFontStack(),
            readGlobalMonoFontStack(),
            readCustomFonts(),
          ]);
        const hydratedFontStack =
          globalFontStack.length > 0
            ? globalFontStack
            : parseFontStack(settings.fontFamily);
        const hydratedFontFamily = serializeFontStack(hydratedFontStack);
        const hydratedMonoFontStack =
          globalMonoFontStack.length > 0
            ? globalMonoFontStack
            : parseFontStack(settings.monoFontFamily);
        const hydratedMonoFontFamily = serializeFontStack(
          hydratedMonoFontStack,
        );
        const presetEntries = await Promise.all(
          POPULAR_SITE_PRESETS.map(
            async (preset) =>
              [
                preset.host,
                (await readHostSettings(preset.host)).fontEnabled,
              ] as const,
          ),
        );

        if (!mounted) {
          return;
        }

        setHostname(host);
        setPageName(host);
        setFontStack(hydratedFontStack);
        setFontFamily(hydratedFontFamily);
        setMonoFontFamily(hydratedMonoFontFamily);
        setFontEnabled(settings.fontEnabled);
        setGlobalEnabled(enabled);
        setCustomFonts(fonts);
        setPresetStates(Object.fromEntries(presetEntries));
      } catch (error) {
        console.error(error);
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleOpenCSSEditor() {
    try {
      const tab = await getActiveTab();
      const hostname = getHostname(tab.url);

      const editorUrl = chrome.runtime.getURL(
        `css-editor.html?hostname=${encodeURIComponent(hostname || "")}`,
      );

      await chrome.tabs.create({ url: editorUrl });
    } catch (error) {
      console.error("Error opening CSS editor:", error);
    }
  }

  async function handleOpenFontManager() {
    try {
      const managerUrl = chrome.runtime.getURL("font-manager.html");
      await chrome.tabs.create({ url: managerUrl });
    } catch (error) {
      console.error("Error opening font manager:", error);
    }
  }

  async function saveAndInject(nextSettings: StyleShiftSettings) {
    if (!hostname) {
      return;
    }

    await updateHostSettings(hostname, nextSettings);
    const tab = await getActiveTab();
    await requestReinject(tab.id);
  }

  // Persisting to chrome.storage is enough to update every open tab: each tab's
  // content script listens via chrome.storage.onChanged and re-applies itself.
  async function handleGlobalToggle(checked: boolean) {
    setGlobalEnabled(checked);
    await updateGlobalEnabled(checked);
  }

  async function persistFontStack(nextFontStack: string[]) {
    const nextFontFamily = serializeFontStack(nextFontStack);

    setFontStack(nextFontStack);
    setFontFamily(nextFontFamily);
    await updateGlobalFontStack(nextFontStack);

    if (hostname) {
      const hostSettings = await readHostSettings(hostname);
      await updateHostSettings(hostname, {
        ...hostSettings,
        fontFamily: nextFontFamily,
        monoFontFamily,
        fontEnabled,
      });
    }
  }

  async function addFontChip(fontName = fontDraft) {
    const nextFont = fontName.trim().replace(/,/g, "");

    if (!nextFont) {
      return;
    }

    const alreadyExists = fontStack.some(
      (font) => font.toLowerCase() === nextFont.toLowerCase(),
    );

    setFontDraft("");

    if (alreadyExists) {
      return;
    }

    await persistFontStack([...fontStack, nextFont]);
  }

  async function removeFontChip(fontToRemove: string) {
    await persistFontStack(fontStack.filter((font) => font !== fontToRemove));
  }

  async function persistMonoFont(nextFont: string) {
    const nextFontFamily = serializeFontStack(nextFont ? [nextFont] : []);

    setMonoFontFamily(nextFontFamily);
    await updateGlobalMonoFontStack(nextFont ? [nextFont] : []);

    if (hostname) {
      const hostSettings = await readHostSettings(hostname);
      await updateHostSettings(hostname, {
        ...hostSettings,
        fontFamily,
        monoFontFamily: nextFontFamily,
        fontEnabled,
      });
    }
  }

  async function chooseMonoFont(fontName = monoFontDraft) {
    const nextFont = fontName.trim().replace(/,/g, "");

    if (!nextFont) {
      return;
    }

    setMonoFontDraft("");
    setMonoFontComboboxOpen(false);
    await persistMonoFont(nextFont);
  }

  async function clearMonoFont() {
    setMonoFontDraft("");
    await persistMonoFont("");
  }

  async function handleFontToggle(checked: boolean) {
    setFontEnabled(checked);
    const matchedPreset = POPULAR_SITE_PRESETS.find((preset) =>
      hostMatchesPreset(hostname, preset.host),
    );

    if (matchedPreset) {
      setPresetStates((previous) => ({
        ...previous,
        [matchedPreset.host]: checked,
      }));
    }

    await saveAndInject({
      fontFamily,
      monoFontFamily,
      fontEnabled: checked,
      customCSS: (await readHostSettings(hostname)).customCSS,
    });
  }

  async function handlePresetToggle(host: string) {
    const current = presetStates[host] ?? true;
    const next = !current;
    const settings = await readHostSettings(host);

    await updateHostSettings(host, {
      ...settings,
      fontFamily,
      monoFontFamily,
      fontEnabled: next,
    });

    setPresetStates((previous) => ({ ...previous, [host]: next }));

    // Presets are stored under their bare host (e.g. "google.com"), but the
    // active tab's content script reads settings under its exact hostname (e.g.
    // "www.google.com"). When the toggled preset is the current site, also
    // persist under the actual hostname so the change takes effect, then nudge
    // the tab to re-apply.
    if (hostMatchesPreset(hostname, host)) {
      setFontEnabled(next);
      await updateHostSettings(hostname, {
        ...settings,
        fontFamily,
        monoFontFamily,
        fontEnabled: next,
      });
      const tab = await getActiveTab();
      await requestReinject(tab.id);
    }
  }

  return (
    <main className="w-[380px] overflow-hidden bg-background text-foreground">
      <Card className="rounded-none border-0 bg-transparent shadow-none">
        <CardContent className="space-y-2 p-2.5">
          <section className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="styleshift-enabled"
                className="text-lg font-semibold"
              >
                StyleShift
              </Label>
              <div className="text-[10px] leading-3 text-muted-foreground">
                {globalEnabled
                  ? "Enabled for all websites"
                  : "Disabled for all websites"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-7 w-7 bg-card hover:bg-accent"
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              <Switch
                id="styleshift-enabled"
                checked={globalEnabled}
                onCheckedChange={handleGlobalToggle}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <div className="space-y-1.5">
              <LabelWithHelp
                htmlFor="font-family"
                help="Add font names installed on your system, or choose fonts you uploaded in StyleShift."
              >
                Font family
              </LabelWithHelp>
              <Popover
                open={fontComboboxOpen}
                onOpenChange={setFontComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="font-family"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={fontComboboxOpen}
                    className="group h-auto min-h-9 w-full items-center justify-between px-2 py-1"
                    disabled={!canApply}
                  >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 self-center">
                      {fontStack.length ? (
                        fontStack.map((font) => (
                          <Badge
                            key={font}
                            variant="secondary"
                            className="min-h-7 min-w-0 max-w-[155px] gap-1 pr-1 transition-colors group-hover:border-primary/25 group-hover:bg-zinc-300 group-hover:text-foreground dark:group-hover:border-white/25 dark:group-hover:bg-zinc-700 dark:group-hover:text-white"
                          >
                            <span className="min-w-0 truncate">{font}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 rounded-sm group-hover:text-foreground hover:bg-white/40 hover:text-foreground dark:group-hover:text-white dark:hover:bg-white/10 dark:hover:text-white"
                              aria-label={`Remove ${font}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                removeFontChip(font);
                              }}
                              disabled={!canApply}
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          </Badge>
                        ))
                      ) : (
                        <span className="px-1 text-sm font-normal text-muted-foreground">
                          Type font and press Enter
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 self-center opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[348px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Add font"
                      value={fontDraft}
                      onValueChange={setFontDraft}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addFontChip();
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        Press Enter to save this font.
                      </CommandEmpty>
                      {fontStack.length > 0 ? (
                        <CommandGroup heading="Saved fonts">
                          {fontStack.map((font) => (
                            <CommandItem
                              key={font}
                              value={font}
                              onSelect={() => removeFontChip(font)}
                            >
                              <span className="flex-1 truncate">{font}</span>
                              <X
                                className="h-4 w-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ) : null}
                      {uploadedFontNames.filter(
                        (font) =>
                          !fontStack.some(
                            (saved) =>
                              saved.toLowerCase() === font.toLowerCase(),
                          ),
                      ).length > 0 ? (
                        <CommandGroup heading="Uploaded fonts">
                          {uploadedFontNames
                            .filter(
                              (font) =>
                                !fontStack.some(
                                  (saved) =>
                                    saved.toLowerCase() === font.toLowerCase(),
                                ),
                            )
                            .map((font) => (
                              <CommandItem
                                key={font}
                                value={font}
                                onSelect={() => addFontChip(font)}
                              >
                                <span className="flex-1 truncate">{font}</span>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      ) : null}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <LabelWithHelp
                  muted
                  help="These popular sites can be enabled or disabled before you visit them. Active sites use your selected fonts when StyleShift is on."
                >
                  Pre-activated sites
                </LabelWithHelp>
                <span className="text-[10px] text-muted-foreground">
                  click to toggle
                </span>
              </div>
              <div className="grid grid-cols-9 justify-between gap-1">
                {presetColumns.map((column, columnIndex) => (
                  <div
                    key={columnIndex}
                    className="flex flex-col items-center gap-1"
                  >
                    {column.map((preset) => {
                      const active = presetStates[preset.host] ?? true;

                      return (
                        <Button
                          key={preset.host}
                          type="button"
                          variant="outline"
                          size="icon"
                          className={[
                            "relative h-8 w-8 overflow-hidden border p-0 transition-colors",
                            active
                              ? "border-primary/25 bg-secondary text-foreground hover:border-primary/45 hover:bg-zinc-300 hover:shadow-sm dark:border-white/25 dark:bg-zinc-800 dark:hover:border-white/50 dark:hover:bg-zinc-700"
                              : "border-border bg-card opacity-65 hover:border-primary/35 hover:bg-white hover:opacity-100 hover:shadow-sm dark:bg-zinc-950 dark:hover:border-white/35 dark:hover:bg-zinc-900",
                          ].join(" ")}
                          title={`${active ? "Disable" : "Enable"} ${preset.label}`}
                          aria-pressed={active}
                          onClick={() => handlePresetToggle(preset.host)}
                          disabled={!globalEnabled}
                        >
                          {failedPresetIcons[preset.host] ? (
                            <span className="text-[10px] font-semibold">
                              {preset.icon}
                            </span>
                          ) : (
                            <img
                              src={`https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${preset.svgIcon}/default.svg`}
                              alt=""
                              className="h-5 w-5 object-contain"
                              onError={() =>
                                setFailedPresetIcons((previous) => ({
                                  ...previous,
                                  [preset.host]: true,
                                }))
                              }
                            />
                          )}
                          <span className="sr-only">{preset.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="font-enabled"
                checked={fontEnabled}
                onCheckedChange={(checked) =>
                  handleFontToggle(checked === true)
                }
                disabled={!canApply}
              />
              <Label htmlFor="font-enabled" className="truncate">
                Apply font for {pageName}
              </Label>
              <HelpTooltip
                label="Apply font"
                help={`Turn StyleShift font changes on or off for ${pageName}.`}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <div className="space-y-1.5">
              <LabelWithHelp
                htmlFor="mono-font-family"
                help="Choose one font for code blocks, editors, preformatted text, and monospace content. You can type a system font name or pick an uploaded font."
              >
                Code font
              </LabelWithHelp>
              <Popover
                open={monoFontComboboxOpen}
                onOpenChange={setMonoFontComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="mono-font-family"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={monoFontComboboxOpen}
                    className="group h-auto min-h-9 w-full items-center justify-between px-2 py-1"
                    disabled={!canApply}
                  >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 self-center">
                      {monoFontFamily ? (
                        <Badge
                          variant="secondary"
                          className="min-h-7 max-w-[220px] gap-1 pr-1 transition-colors group-hover:border-primary/25 group-hover:bg-zinc-300 group-hover:text-foreground dark:group-hover:border-white/25 dark:group-hover:bg-zinc-700 dark:group-hover:text-white"
                        >
                          <span className="truncate">{monoFontFamily}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 rounded-sm group-hover:text-foreground hover:bg-white/40 hover:text-foreground dark:group-hover:text-white dark:hover:bg-white/10 dark:hover:text-white"
                            aria-label="Clear code font"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              clearMonoFont();
                            }}
                            disabled={!canApply}
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </Badge>
                      ) : (
                        <span className="px-1 text-sm font-normal text-muted-foreground">
                          Pick one code font
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 self-center opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[348px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Add code font"
                      value={monoFontDraft}
                      onValueChange={setMonoFontDraft}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          chooseMonoFont();
                        }
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>Type a font and press Enter.</CommandEmpty>
                      {uploadedFontNames.length > 0 ? (
                        <CommandGroup heading="Uploaded fonts">
                          {uploadedFontNames.map((font) => (
                            <CommandItem
                              key={font}
                              value={font}
                              onSelect={() => chooseMonoFont(font)}
                            >
                              <span className="flex-1 truncate">{font}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ) : null}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </section>

          <Separator />
          <section className="space-y-1.5">
            <LabelWithHelp help="Open the CSS editor for this site or manage uploaded fonts saved in the extension.">
              Tools
            </LabelWithHelp>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenCSSEditor}
                disabled={!canApply}
                className="h-8 gap-2"
              >
                <FileCode2 className="h-4 w-4" />
                CSS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenFontManager}
                className="h-8 gap-2"
              >
                <Upload className="h-4 w-4" />
                Fonts
              </Button>
            </div>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
