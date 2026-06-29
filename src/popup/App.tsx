import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  Braces,
  ChevronsUpDown,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  Info,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  Type,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomFontManager } from "@/components/custom-font-manager";
import { GoogleFontBrowser } from "@/components/google-font-browser";
import { HelpTooltip, LabelWithHelp } from "@/components/help";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/shared/i18n/use-i18n";
import { BUILTIN_FONT_NAMES, BUILTIN_FONTS } from "@/shared/builtin-fonts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { LOCALES } from "@/shared/i18n/locales";
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
  isInjectableUrl,
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
import { readGoogleApiKey, saveGoogleApiKey } from "@/shared/google-fonts";
import type { ReinjectMessage } from "@/shared/messages";
import { formatCSS } from "@/css-editor/format-css";

const REINJECT_MESSAGE: ReinjectMessage = { type: "STYLESHIFT_REINJECT" };

type TabId = "fonts" | "upload" | "css" | "settings" | "about";

const TABS: { id: TabId; icon: typeof Type; labelKey: string }[] = [
  { id: "fonts", icon: Type, labelKey: "tabs.fonts" },
  { id: "upload", icon: Upload, labelKey: "tabs.upload" },
  { id: "css", icon: FileCode2, labelKey: "popup.css" },
  { id: "settings", icon: Settings, labelKey: "tabs.settings" },
  { id: "about", icon: Info, labelKey: "tabs.about" },
];

export function App() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>("fonts");
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
  const [importNonce, setImportNonce] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [customCSS, setCustomCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [savedCSS, setSavedCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [isSaving, setIsSaving] = useState(false);
  const { locale, setLocale } = useI18n();
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
        setCustomCSS(settings.customCSS);
        setSavedCSS(settings.customCSS);
      } catch (error) {
        console.error(error);
      }
    }

    loadSettings();
    readGoogleApiKey().then(setApiKey);

    return () => {
      mounted = false;
    };
  }, []);

  async function saveAndInject(nextSettings: StyleShiftSettings) {
    if (!hostname) {
      return;
    }

    await updateHostSettings(hostname, nextSettings);
    const tab = await getActiveTab();
    await requestReinject(tab.id);
  }

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

  async function handleSaveKey() {
    await saveGoogleApiKey(apiKey);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  }

  async function reloadCustomFonts() {
    const fonts = await readCustomFonts();
    setCustomFonts(fonts);
  }

  async function handleSaveCSS() {
    if (!hostname) return;

    setIsSaving(true);
    try {
      const formattedCSS = formatCSS(customCSS);
      const settings = await readHostSettings(hostname);
      settings.customCSS = formattedCSS;
      await updateHostSettings(hostname, settings);
      setCustomCSS(formattedCSS);
      setSavedCSS(formattedCSS);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id && isInjectableUrl(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, REINJECT_MESSAGE);
        } catch {
          // Content script might not be ready
        }
      }
    } catch (error) {
      console.error("Error saving CSS:", error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveCSS() {
    if (!hostname) return;

    try {
      const settings = await readHostSettings(hostname);
      settings.customCSS = "";
      await updateHostSettings(hostname, settings);
      setCustomCSS("");
      setSavedCSS("");

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id && isInjectableUrl(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, REINJECT_MESSAGE);
        } catch {
          // Content script might not be ready
        }
      }
    } catch (error) {
      console.error("Error removing CSS:", error);
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextCSS = `${customCSS.slice(0, start)}  ${customCSS.slice(end)}`;

    setCustomCSS(nextCSS);
    window.requestAnimationFrame(() => {
      target.selectionStart = start + 2;
      target.selectionEnd = start + 2;
    });
  }

  const hasChanges = customCSS !== savedCSS;
  const lineNumbers = customCSS.split("\n").map((_, index) => index + 1);

  return (
    <main className="w-[480px] overflow-hidden bg-background text-foreground fabric-weave">
      <Card className="rounded-none border-0 bg-transparent shadow-none !bg-none p-1">
        <CardContent className="space-y-2 p-2.5">
          <section className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="styleshift-enabled"
                className="text-lg font-display"
              >
                StyleShift
              </Label>
              <div className="text-[10px] leading-3 text-muted-foreground">
                {globalEnabled
                  ? t("popup.statusEnabled")
                  : t("popup.statusDisabled")}
              </div>
            </div>
            <div className="flex gap-1">
              <Switch
                id="styleshift-enabled"
                checked={globalEnabled}
                onCheckedChange={handleGlobalToggle}
              />
            </div>
          </section>

          <Separator />

          <div>
            <nav className="relative z-10 flex gap-[6px] mb-[-1px]">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={[
                      "relative flex items-center justify-center gap-1.5 px-3 py-[11px] text-xs font-semibold border border-border rounded-t-lg cursor-pointer transition-all duration-150",
                      isActive
                        ? "bg-[var(--fabric-linen)] text-foreground border-b-[var(--fabric-linen)] shadow-[inset_0_2px_0_var(--fabric-denim)] z-20"
                        : "bg-[#D3BE9F] text-[#7a6a58] shadow-[inset_0_-4px_8px_rgba(68,42,22,.12)] hover:text-foreground",
                    ].join(" ")}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="h-3 w-3" />
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </nav>
            <div className="relative rounded-b-lg rounded-tr-lg border border-border bg-[#F5EDE0] p-3 shadow-fabric fabric-weave fabric-stitch">
              {activeTab === "fonts" && (
                <>
                  <section className="space-y-2">
                    <div className="space-y-1.5">
                      <LabelWithHelp
                        htmlFor="font-family"
                        help={t("popup.fontFamilyHelp")}
                      >
                        {t("popup.fontFamily")}
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
                                    className="min-h-7 min-w-0 max-w-[180px] gap-1 pr-1 transition-colors group-hover:brightness-[.97]"
                                  >
                                    <span className="min-w-0 truncate">
                                      {font}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 rounded-sm hover:bg-foreground/10"
                                      aria-label={`${t("common.close")} ${font}`}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        removeFontChip(font);
                                      }}
                                      disabled={!canApply}
                                    >
                                      <X
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </Badge>
                                ))
                              ) : (
                                <span className="px-1 text-sm font-normal text-muted-foreground">
                                  {t("popup.fontPlaceholder")}
                                </span>
                              )}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 self-center opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[448px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder={t("popup.addFont")}
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
                                {t("popup.pressEnterSave")}
                              </CommandEmpty>
                              {fontStack.length > 0 ? (
                                <CommandGroup heading={t("popup.savedFonts")}>
                                  {fontStack.map((font) => (
                                    <CommandItem
                                      key={font}
                                      value={font}
                                      onSelect={() => removeFontChip(font)}
                                    >
                                      <span className="flex-1 truncate">
                                        {font}
                                      </span>
                                      <X
                                        className="h-4 w-4 text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ) : null}
                              {BUILTIN_FONT_NAMES.filter(
                                (font) =>
                                  !fontStack.some(
                                    (saved) =>
                                      saved.toLowerCase() ===
                                      font.toLowerCase(),
                                  ),
                              ).length > 0 ? (
                                <CommandGroup heading={t("popup.bundledFonts")}>
                                  {BUILTIN_FONT_NAMES.filter(
                                    (font) =>
                                      !fontStack.some(
                                        (saved) =>
                                          saved.toLowerCase() ===
                                          font.toLowerCase(),
                                      ),
                                  ).map((font) => (
                                    <CommandItem
                                      key={font}
                                      value={font}
                                      onSelect={() => addFontChip(font)}
                                    >
                                      <span className="flex-1 truncate">
                                        {font}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ) : null}
                              {uploadedFontNames.filter(
                                (font) =>
                                  !fontStack.some(
                                    (saved) =>
                                      saved.toLowerCase() ===
                                      font.toLowerCase(),
                                  ),
                              ).length > 0 ? (
                                <CommandGroup
                                  heading={t("popup.uploadedFonts")}
                                >
                                  {uploadedFontNames
                                    .filter(
                                      (font) =>
                                        !fontStack.some(
                                          (saved) =>
                                            saved.toLowerCase() ===
                                            font.toLowerCase(),
                                        ),
                                    )
                                    .map((font) => (
                                      <CommandItem
                                        key={font}
                                        value={font}
                                        onSelect={() => addFontChip(font)}
                                      >
                                        <span className="flex-1 truncate">
                                          {font}
                                        </span>
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
                        <LabelWithHelp muted help={t("popup.fontFamilyHelp")}>
                          {t("popup.preActivated")}
                        </LabelWithHelp>
                        <span className="text-[10px] text-muted-foreground">
                          {t("popup.clickToToggle")}
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
                                    "relative h-10 w-10 overflow-hidden border p-0 transition-all fabric-stitch-sm",
                                    active
                                      ? "border-[var(--fabric-stitch)] bg-[var(--fabric-linen)] text-foreground hover:brightness-[.97] hover:shadow-sm"
                                      : "border-border bg-[var(--fabric-canvas)] opacity-55 hover:border-[var(--fabric-stitch)] hover:opacity-100 hover:shadow-sm",
                                  ].join(" ")}
                                  title={`${active ? "Disable" : "Enable"} ${preset.label}`}
                                  aria-pressed={active}
                                  onClick={() =>
                                    handlePresetToggle(preset.host)
                                  }
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
                                      className="h-6 w-6 object-contain"
                                      onError={() =>
                                        setFailedPresetIcons((previous) => ({
                                          ...previous,
                                          [preset.host]: true,
                                        }))
                                      }
                                    />
                                  )}
                                  <span className="sr-only">
                                    {preset.label}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        id="font-enabled"
                        checked={fontEnabled}
                        onCheckedChange={(checked) =>
                          handleFontToggle(checked === true)
                        }
                        disabled={!canApply}
                      />
                      <Label htmlFor="font-enabled" className="truncate">
                        {t("popup.applyFontFor", { page: pageName })}
                      </Label>
                      <HelpTooltip
                        label={t("popup.applyFontFor", { page: pageName })}
                        help={t("popup.applyFontHelp", { page: pageName })}
                      />
                    </div>
                  </section>

                  <Separator className="my-2" />

                  <section className="space-y-2">
                    <div className="space-y-1.5">
                      <LabelWithHelp
                        htmlFor="mono-font-family"
                        help={t("popup.codeFontHelp")}
                      >
                        {t("popup.codeFont")}
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
                                  className="min-h-7 max-w-[280px] gap-1 pr-1 transition-colors group-hover:brightness-[.97]"
                                >
                                  <span className="truncate">
                                    {monoFontFamily}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 rounded-sm hover:bg-foreground/10"
                                    aria-label={t("popup.codeFont")}
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
                                  {t("popup.pickCodeFont")}
                                </span>
                              )}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 self-center opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[448px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder={t("popup.addCodeFont")}
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
                              <CommandEmpty>
                                {t("popup.typeFontEnter")}
                              </CommandEmpty>
                              {BUILTIN_FONT_NAMES.length > 0 ? (
                                <CommandGroup heading={t("popup.bundledFonts")}>
                                  {BUILTIN_FONT_NAMES.map((font) => (
                                    <CommandItem
                                      key={font}
                                      value={font}
                                      onSelect={() => chooseMonoFont(font)}
                                    >
                                      <span className="flex-1 truncate">
                                        {font}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ) : null}
                              {uploadedFontNames.length > 0 ? (
                                <CommandGroup
                                  heading={t("popup.uploadedFonts")}
                                >
                                  {uploadedFontNames.map((font) => (
                                    <CommandItem
                                      key={font}
                                      value={font}
                                      onSelect={() => chooseMonoFont(font)}
                                    >
                                      <span className="flex-1 truncate">
                                        {font}
                                      </span>
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
                </>
              )}

              {activeTab === "upload" && (
                <section className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">
                      {t("fonts.bundledTitle")}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("fonts.bundledSubtitle")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {BUILTIN_FONTS.map((font) => (
                        <span
                          key={font.name}
                          className="relative rounded-full border border-[var(--fabric-stitch)] bg-[var(--fabric-linen)] px-2.5 py-0.5 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.3)] fabric-stitch-pill"
                        >
                          {font.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <CustomFontManager
                    key={importNonce}
                    onFontsChanged={reloadCustomFonts}
                  />

                  <Separator />

                  <div>
                    <Label className="text-sm font-semibold">
                      {t("fonts.googleTitle")}
                    </Label>
                    <div className="mt-2">
                      <GoogleFontBrowser
                        onImported={() => {
                          setImportNonce((value) => value + 1);
                          reloadCustomFonts();
                        }}
                        onOpenSettings={() => setActiveTab("settings")}
                      />
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "css" && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-sm font-semibold">
                      <Braces className="h-3.5 w-3.5" />
                      {t("editor.customCSS")}
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => setCustomCSS(formatCSS(customCSS))}
                        variant="mustard"
                        size="sm"
                        className="gap-1 h-6 text-[10px] px-2"
                      >
                        <WandSparkles className="h-3 w-3" />
                        {t("editor.format")}
                      </Button>
                    </div>
                  </div>
                  {hostname && (
                    <p className="text-[10px] text-muted-foreground">
                      {t("editor.editingFor")}{" "}
                      <span className="font-mono font-semibold">
                        {hostname}
                      </span>
                    </p>
                  )}
                  <div className="overflow-hidden rounded-lg border border-border bg-card shadow-fabric fabric-stitch">
                    <div className="flex items-center justify-between border-b border-border bg-[var(--fabric-raised)]/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>styleshift.css</span>
                      <span>
                        {t("editor.lines", { count: lineNumbers.length })}
                      </span>
                    </div>
                    <div className="grid max-h-[40vh] min-h-[160px] grid-cols-[2.5rem_1fr] overflow-auto bg-[#2E241D] text-[#F8F3EA]">
                      <div className="select-none border-r border-[#A38362]/20 bg-black/15 py-2 pr-2 text-right font-mono text-[10px] leading-5 text-[#8D7C6A]">
                        {lineNumbers.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                      <textarea
                        value={customCSS}
                        onChange={(e) => setCustomCSS(e.target.value)}
                        onKeyDown={handleEditorKeyDown}
                        spellCheck={false}
                        placeholder={`/* Custom CSS */\nbody {\n  background: #f0f0f0;\n}`}
                        className="min-h-[160px] resize-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 text-[#F8F3EA] outline-none placeholder:text-[#8D7C6A] focus:ring-0"
                        disabled={!canApply}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      onClick={handleSaveCSS}
                      disabled={isSaving || !hasChanges || !canApply}
                      variant="olive"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? t("editor.saving") : t("editor.saveCss")}
                    </Button>
                    <Button
                      onClick={handleRemoveCSS}
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={!canApply}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("editor.removeCss")}
                    </Button>
                    <Button
                      onClick={() => setCustomCSS(savedCSS)}
                      disabled={!hasChanges}
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("common.reset")}
                    </Button>
                    <Button
                      onClick={() => navigator.clipboard.writeText(customCSS)}
                      variant="default"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t("common.copy")}
                    </Button>
                  </div>

                  {hasChanges && (
                    <p className="text-xs text-[var(--fabric-terracotta)]">
                      {t("editor.unsaved")}
                    </p>
                  )}
                </section>
              )}

              {activeTab === "settings" && (
                <section className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">
                      {t("settings.language")}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("settings.languageHelp")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {LOCALES.map((option) => (
                        <Button
                          key={option.code}
                          type="button"
                          variant={
                            option.code === locale ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setLocale(option.code)}
                          className="gap-1.5 h-7 text-xs"
                          aria-pressed={option.code === locale}
                        >
                          {option.code === locale ? (
                            <Check className="h-3 w-3" />
                          ) : null}
                          {option.nativeName}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-semibold">
                      {t("settings.apiKeyTitle")}
                    </Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t("settings.apiKeyHelp")}
                    </p>
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          value={apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          placeholder={t("settings.apiKeyPlaceholder")}
                          className="font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="olive"
                          size="sm"
                          onClick={handleSaveKey}
                          className="gap-1.5 shrink-0"
                        >
                          {justSaved ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              {t("settings.saved")}
                            </>
                          ) : (
                            t("common.save")
                          )}
                        </Button>
                      </div>
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--fabric-blue-thread)] underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t("settings.getKey")}
                      </a>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "about" && (
                <section className="space-y-3">
                  <div className="rounded-lg border border-[var(--fabric-stitch)] bg-[var(--fabric-linen)] p-3 fabric-stitch">
                    <h2 className="text-base font-display">StyleShift</h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {t("about.description")}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {t("about.madeBy")}
                      </span>
                      <span className="text-sm font-semibold">
                        Amir Meimari
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {t("about.contact")}
                      </span>
                      <a
                        href="mailto:amirmeimari@gmail.com"
                        className="text-sm text-[var(--fabric-blue-thread)] underline-offset-4 hover:underline"
                      >
                        amirmeimari@gmail.com
                      </a>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
