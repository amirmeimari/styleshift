import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  ChevronsUpDown,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  Info,
  Moon,
  RotateCcw,
  Save,
  Settings,
  Sun,
  SunMoon,
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
import { FontStatusDot } from "@/components/font-status-dot";
import { HelpTooltip, LabelWithHelp } from "@/components/help";
import { useI18n } from "@/shared/i18n/use-i18n";
import {
  BUILTIN_FONTS,
  BUILTIN_MONO_FONT_NAMES,
  BUILTIN_SANS_FONT_NAMES,
} from "@/shared/builtin-fonts";
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
import type { ThemePref } from "@/shared/theme";
import { useTheme } from "@/shared/theme-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type {
  CustomFont,
  StyleShiftSettings,
  TypographySettings,
} from "@/shared/styleshift";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TYPOGRAPHY,
  POPULAR_SITE_PRESETS,
  TYPOGRAPHY_RANGES,
  clearHostSettings,
  getActiveTab,
  getHostname,
  getMainDomain,
  hostMatchesPreset,
  parseFontStack,
  readAutoEnableAllSites,
  readCustomFonts,
  readGlobalEnabled,
  readGlobalFontStack,
  readGlobalMonoFontStack,
  readHostSettings,
  readTypography,
  requestReinject,
  resolveHostSettings,
  serializeFontStack,
  updateAutoEnableAllSites,
  updateGlobalEnabled,
  updateGlobalFontStack,
  updateGlobalMonoFontStack,
  updateHostSettings,
  updateTypography,
} from "@/shared/styleshift";
import { formatCSS } from "@/css-editor/format-css";
// CodeMirror is by far the largest dependency in the popup and only the CSS
// tab needs it, so it is split into its own chunk and fetched on first use.
// The chunk is served from the extension itself, so this costs no network.
const CssEditor = lazy(() =>
  import("@/css-editor/css-editor").then((module) => ({
    default: module.CssEditor,
  })),
);

type TabId = "fonts" | "upload" | "css" | "settings" | "about";

const TABS: { id: TabId; icon: typeof Type; labelKey: string }[] = [
  { id: "fonts", icon: Type, labelKey: "tabs.fonts" },
  { id: "upload", icon: Upload, labelKey: "tabs.upload" },
  { id: "css", icon: FileCode2, labelKey: "tabs.css" },
  { id: "settings", icon: Settings, labelKey: "tabs.settings" },
  { id: "about", icon: Info, labelKey: "tabs.about" },
];

// Matches the preset grid's `grid-cols-9` below.
const PRESET_COLUMN_COUNT = 9;

type TypographyField = "lineHeight" | "letterSpacing" | "fontWeight";

// Shown on the slider while the field is unset (null), so dragging starts
// from a sensible neutral position instead of jumping from the range's min.
const TYPOGRAPHY_FIELD_NEUTRAL: Record<TypographyField, number> = {
  lineHeight: 1.5,
  letterSpacing: 0,
  fontWeight: 400,
};

const TYPOGRAPHY_CONTROLS: {
  field: TypographyField;
  labelKey: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}[] = [
  {
    field: "lineHeight",
    labelKey: "popup.lineHeight",
    min: TYPOGRAPHY_RANGES.lineHeight.min,
    max: TYPOGRAPHY_RANGES.lineHeight.max,
    step: 0.1,
    format: (value) => value.toFixed(1),
  },
  {
    field: "letterSpacing",
    labelKey: "popup.letterSpacing",
    min: TYPOGRAPHY_RANGES.letterSpacing.min,
    max: TYPOGRAPHY_RANGES.letterSpacing.max,
    step: 0.01,
    format: (value) => `${value.toFixed(2)}em`,
  },
  {
    field: "fontWeight",
    labelKey: "popup.fontWeight",
    min: TYPOGRAPHY_RANGES.fontWeight.min,
    max: TYPOGRAPHY_RANGES.fontWeight.max,
    step: 100,
    format: (value) => String(value),
  },
];

const THEME_OPTIONS: {
  value: ThemePref;
  icon: typeof Sun;
  labelKey: string;
}[] = [
  { value: "light", icon: Sun, labelKey: "settings.themeLight" },
  { value: "dark", icon: Moon, labelKey: "settings.themeDark" },
  { value: "system", icon: SunMoon, labelKey: "settings.themeSystem" },
];

export function App() {
  const { t, dir } = useI18n();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("fonts");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const [hostname, setHostname] = useState("");
  const [pageName, setPageName] = useState("this page");
  const [fontFamily, setFontFamily] = useState(DEFAULT_SETTINGS.fontFamily);
  const [fontStack, setFontStack] = useState<string[]>([]);
  const [fontDraft, setFontDraft] = useState("");
  // The raw family name ("Fira Code"), never the serialized CSS value
  // (`"Fira Code"` with quotes). Serialization happens only at the storage
  // boundary in persistMonoFont, so nothing renders stray quote marks.
  const [monoFont, setMonoFont] = useState(DEFAULT_SETTINGS.monoFontFamily);
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
  const [cssEnabled, setCssEnabled] = useState(true);
  // Which storage key the active tab's settings actually came from - null
  // means nothing matched (defaults), equal to `hostname` means this host has
  // its own record, anything else means it's inheriting from that ancestor.
  const [sourceHost, setSourceHost] = useState<string | null>(null);
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [customCSS, setCustomCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [savedCSS, setSavedCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [isSaving, setIsSaving] = useState(false);
  const [autoEnableAllSites, setAutoEnableAllSites] = useState(false);
  const [typography, setTypography] =
    useState<TypographySettings>(DEFAULT_TYPOGRAPHY);
  const { locale, setLocale } = useI18n();
  const uploadedFontNames = useMemo(
    () => Object.values(customFonts).map((font) => font.name),
    [customFonts],
  );
  const presetColumns = useMemo(() => {
    // Matches the grid-cols-9 layout below. Derived from the preset count
    // rather than hardcoded so a 28th preset doesn't silently vanish off the
    // end of a fixed 27-slot [3,3,...] split.
    const perColumn = Math.ceil(
      POPULAR_SITE_PRESETS.length / PRESET_COLUMN_COUNT,
    );

    return Array.from({ length: PRESET_COLUMN_COUNT }, (_, columnIndex) =>
      POPULAR_SITE_PRESETS.slice(
        columnIndex * perColumn,
        (columnIndex + 1) * perColumn,
      ),
    ).filter((column) => column.length > 0);
  }, []);

  const monoFontOptions = useMemo(
    () => [
      { heading: t("popup.bundledFonts"), fonts: BUILTIN_MONO_FONT_NAMES },
      {
        heading: t("popup.uploadedFonts"),
        fonts: uploadedFontNames.filter(
          (font) =>
            !BUILTIN_MONO_FONT_NAMES.some(
              (builtin) => builtin.toLowerCase() === font.toLowerCase(),
            ),
        ),
      },
    ],
    [t, uploadedFontNames],
  );

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

        const [
          resolved,
          enabled,
          globalFontStack,
          globalMonoFontStack,
          fonts,
          storedTypography,
        ] = await Promise.all([
          resolveHostSettings(host),
          readGlobalEnabled(),
          readGlobalFontStack(),
          readGlobalMonoFontStack(),
          readCustomFonts(),
          readTypography(),
        ]);
        const settings = resolved.settings;
        const hydratedFontStack =
          globalFontStack.length > 0
            ? globalFontStack
            : parseFontStack(settings.fontFamily);
        const hydratedFontFamily = serializeFontStack(hydratedFontStack);
        const hydratedMonoFontStack =
          globalMonoFontStack.length > 0
            ? globalMonoFontStack
            : parseFontStack(settings.monoFontFamily);
        const hydratedMonoFont = hydratedMonoFontStack[0] ?? "";
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
        setPageName(getMainDomain(host));
        setFontStack(hydratedFontStack);
        setFontFamily(hydratedFontFamily);
        setMonoFont(hydratedMonoFont);
        setFontEnabled(settings.fontEnabled);
        setGlobalEnabled(enabled);
        setCustomFonts(fonts);
        setPresetStates(Object.fromEntries(presetEntries));
        setCssEnabled(settings.cssEnabled !== false);
        setSourceHost(resolved.sourceHost);
        setIncludeSubdomains(settings.includeSubdomains !== false);
        setCustomCSS(settings.customCSS);
        setSavedCSS(settings.customCSS);
        setTypography(storedTypography);
      } catch (error) {
        console.error(error);
      }
    }

    loadSettings();
    // chrome.storage is unavailable on non-injectable pages; without a catch
    // this surfaces as an unhandled rejection in the console.
    readAutoEnableAllSites().then(setAutoEnableAllSites).catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  async function saveAndInject(nextSettings: StyleShiftSettings) {
    if (!hostname) {
      return;
    }

    await updateHostSettings(hostname, nextSettings);
    // Writing here always materializes hostname's own record.
    setSourceHost(hostname);

    try {
      const tab = await getActiveTab();
      await requestReinject(tab.id);
    } catch (error) {
      // Active tab may no longer be injectable (navigated to chrome://, the
      // Web Store, etc.) - the setting is already saved, just skip the nudge.
      console.error(error);
    }
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

    // Only mirror onto the host's own record when it already has one -
    // content.ts overwrites fontFamily/monoFontFamily from the global stack
    // unconditionally regardless (see loadAndApply), so this mirror only
    // feeds the popup's own hydration fallback. Writing it for a host that
    // currently inherits would fork it off its ancestor for no reason.
    if (hostname && sourceHost === hostname) {
      const hostSettings = await readHostSettings(hostname);
      await updateHostSettings(hostname, {
        ...hostSettings,
        fontFamily: nextFontFamily,
        monoFontFamily: serializeFontStack(monoFont ? [monoFont] : []),
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
    const nextStack = nextFont ? [nextFont] : [];

    setMonoFont(nextFont);
    await updateGlobalMonoFontStack(nextStack);

    // See the matching comment in persistFontStack.
    if (hostname && sourceHost === hostname) {
      const hostSettings = await readHostSettings(hostname);
      await updateHostSettings(hostname, {
        ...hostSettings,
        fontFamily,
        monoFontFamily: serializeFontStack(nextStack),
        fontEnabled,
      });
    }
  }

  async function chooseMonoFont(fontName: string) {
    const nextFont = fontName.trim().replace(/,/g, "");

    if (!nextFont) {
      return;
    }

    setMonoFontComboboxOpen(false);
    await persistMonoFont(nextFont);
  }

  async function clearMonoFont() {
    setMonoFontComboboxOpen(false);
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

    const hostSettings = await readHostSettings(hostname);
    await saveAndInject({
      ...hostSettings,
      fontFamily,
      monoFontFamily: serializeFontStack(monoFont ? [monoFont] : []),
      fontEnabled: checked,
    });
  }

  async function handlePresetToggle(host: string) {
    const current = presetStates[host] ?? true;
    const next = !current;
    // Start from the preset host's own record if it has one, never from
    // whatever it currently inherits - spreading an inherited ancestor's
    // settings here would copy that ancestor's CSS across a domain boundary.
    const resolved = await resolveHostSettings(host);
    const base =
      resolved.sourceHost === host ? resolved.settings : DEFAULT_SETTINGS;

    await updateHostSettings(host, {
      ...base,
      fontFamily,
      monoFontFamily: serializeFontStack(monoFont ? [monoFont] : []),
      fontEnabled: next,
    });

    setPresetStates((previous) => ({ ...previous, [host]: next }));

    if (!hostMatchesPreset(hostname, host)) {
      return;
    }

    setFontEnabled(next);

    if (host === hostname) {
      // The write above just materialized hostname's own record.
      setSourceHost(hostname);
    } else if (sourceHost === hostname) {
      // hostname already shadows this preset with its own record (e.g.
      // "www.github.com" vs "github.com") - keep it in sync. Otherwise
      // hostname now inherits the preset's new settings automatically, and
      // writing here would fork it off unnecessarily.
      const currentSettings = await readHostSettings(hostname);
      await updateHostSettings(hostname, {
        ...currentSettings,
        fontFamily,
        monoFontFamily: serializeFontStack(monoFont ? [monoFont] : []),
        fontEnabled: next,
      });
    }

    try {
      const tab = await getActiveTab();
      await requestReinject(tab.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function persistTypography(
    field: TypographyField,
    value: number | null,
  ) {
    // Optimistic update - the storage.onChanged listener in content.ts
    // reapplies the page's styling on its own, so no reinject nudge is
    // needed here (same pattern as persistFontStack/persistMonoFont).
    setTypography((previous) => ({ ...previous, [field]: value }));
    const next = await updateTypography({ [field]: value });
    setTypography(next);
  }

  async function handleAutoEnableToggle(checked: boolean) {
    setAutoEnableAllSites(checked);
    await updateAutoEnableAllSites(checked);
  }

  async function reloadCustomFonts() {
    const fonts = await readCustomFonts();
    setCustomFonts(fonts);
  }

  async function handleCssEnabledToggle(checked: boolean) {
    setCssEnabled(checked);

    if (!hostname) {
      return;
    }

    // Only cssEnabled changes. The rest of the record round-trips through
    // readHostSettings, which resolves fontEnabled from the auto-enable and
    // preset rules; spreading the raw stored record instead would write
    // `fontEnabled: false` for a host that has none yet, switching the page's
    // font off along with its CSS. src/content/content.test.ts pins this.
    const settings = await readHostSettings(hostname);
    await saveAndInject({ ...settings, cssEnabled: checked });
  }

  async function handleSaveCSS() {
    if (!hostname) return;

    setIsSaving(true);
    try {
      // Persist exactly what the editor holds - formatting is the Format
      // button's job, not an implicit side effect of saving.
      const settings = await readHostSettings(hostname);
      await saveAndInject({ ...settings, customCSS });
      setSavedCSS(customCSS);
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
      await saveAndInject({ ...settings, customCSS: "" });
      setCustomCSS("");
      setSavedCSS("");
    } catch (error) {
      console.error("Error removing CSS:", error);
    }
  }

  async function handleIncludeSubdomainsToggle(checked: boolean) {
    setIncludeSubdomains(checked);

    if (!hostname) {
      return;
    }

    const settings = await readHostSettings(hostname);
    await saveAndInject({ ...settings, includeSubdomains: checked });
  }

  // Drops hostname's own record so it falls back to whatever it would
  // otherwise inherit (or to defaults, if nothing does).
  async function handleResetHost() {
    if (!hostname) {
      return;
    }

    await clearHostSettings(hostname);
    const resolved = await resolveHostSettings(hostname);
    const settings = resolved.settings;

    setSourceHost(resolved.sourceHost);
    setFontEnabled(settings.fontEnabled);
    setCssEnabled(settings.cssEnabled !== false);
    setIncludeSubdomains(settings.includeSubdomains !== false);
    setCustomCSS(settings.customCSS);
    setSavedCSS(settings.customCSS);

    const matchedPreset = POPULAR_SITE_PRESETS.find((preset) =>
      hostMatchesPreset(hostname, preset.host),
    );
    if (matchedPreset) {
      setPresetStates((previous) => ({
        ...previous,
        [matchedPreset.host]: settings.fontEnabled,
      }));
    }

    try {
      const tab = await getActiveTab();
      await requestReinject(tab.id);
    } catch (error) {
      console.error(error);
    }
  }

  // The popup is 480px wide and closes the instant it loses focus, which is
  // why import's file picker (and any serious editing) has to live on the
  // options page instead - open it pre-scoped to this host.
  function handlePopOutEditor() {
    if (!hostname || typeof chrome === "undefined" || !chrome.tabs) {
      return;
    }
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        `options.html?host=${encodeURIComponent(hostname)}`,
      ),
    });
  }

  const hasChanges = customCSS !== savedCSS;

  function handleTabsKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);

    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex =
        (currentIndex + (dir === "rtl" ? -1 : 1) + TABS.length) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex + (dir === "rtl" ? 1 : -1) + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  }

  return (
    <main className="w-[480px] max-h-[600px] overflow-y-auto overflow-x-hidden bg-background text-foreground fabric-weave">
      <Card className="rounded-none border-0 bg-transparent shadow-none !bg-none p-1">
        <CardContent className="space-y-2 p-2.5">
          <section className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 p-1">
              <img
                src="/logo.png"
                alt="StyleShift"
                className="h-14 object-contain"
              />
              {/* <div className="text-[10px] leading-3 text-muted-foreground">
                {globalEnabled
                  ? t("popup.statusEnabled")
                  : t("popup.statusDisabled")}
              </div> */}
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
            <nav
              role="tablist"
              aria-orientation="horizontal"
              onKeyDown={handleTabsKeyDown}
              className="relative z-10 flex gap-[6px] mb-[-1px] ms-[10px]"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    id={`tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="styleshift-tabpanel"
                    tabIndex={isActive ? 0 : -1}
                    className={[
                      "relative flex items-center justify-center gap-1.5 px-3 py-[11px] text-xs font-semibold border border-border rounded-t-lg cursor-pointer transition-all duration-150",
                      isActive
                        ? "bg-[var(--fabric-linen)] text-foreground border-b-[var(--fabric-linen)] shadow-[inset_0_2px_0_var(--fabric-denim)] z-20"
                        : "bg-[var(--fabric-tab-inactive)] text-[var(--fabric-tab-inactive-fg)] shadow-[inset_0_-4px_8px_rgba(var(--fabric-shadow-rgb),.12)] hover:text-foreground",
                    ].join(" ")}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="h-3 w-3" />
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </nav>
            <div
              id="styleshift-tabpanel"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={0}
              className="relative rounded-lg border border-border bg-[var(--fabric-panel)] p-3 shadow-fabric fabric-weave fabric-stitch"
            >
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
                                    <FontStatusDot
                                      name={font}
                                      uploadedNames={uploadedFontNames}
                                    />
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
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(480px-1.25rem)] p-0"
                          align="start"
                          sideOffset={2}
                          collisionPadding={8}
                          usePortal={false}
                        >
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
                            <CommandList className="max-h-[200px]">
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
                              {BUILTIN_SANS_FONT_NAMES.filter(
                                (font) =>
                                  !fontStack.some(
                                    (saved) =>
                                      saved.toLowerCase() ===
                                      font.toLowerCase(),
                                  ),
                              ).length > 0 ? (
                                <CommandGroup heading={t("popup.bundledFonts")}>
                                  {BUILTIN_SANS_FONT_NAMES.filter(
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
                                      <FontStatusDot
                                        name={font}
                                        uploadedNames={uploadedFontNames}
                                      />
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
                                        <FontStatusDot
                                          name={font}
                                          uploadedNames={uploadedFontNames}
                                        />
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
                                  title={t(
                                    active
                                      ? "popup.disablePreset"
                                      : "popup.enablePreset",
                                    { site: preset.label },
                                  )}
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
                    {sourceHost && sourceHost !== hostname && (
                      <p className="pl-6 text-[10px] text-muted-foreground">
                        {t("popup.inheritedFrom", { host: sourceHost })}
                      </p>
                    )}
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
                      {/* Single-select: exactly one code font applies at a
                          time, so this shows the chosen name as plain text
                          with a check beside it in the list - not the
                          removable chips the multi-font text picker uses. */}
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
                            className="h-9 w-full items-center justify-between px-3 font-normal"
                            disabled={!canApply}
                          >
                            <span className="min-w-0 flex-1 truncate text-start text-sm">
                              {monoFont ? (
                                <span
                                  style={{
                                    fontFamily: `'${monoFont}', ui-monospace, monospace`,
                                  }}
                                >
                                  {monoFont}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {t("popup.pickCodeFont")}
                                </span>
                              )}
                            </span>
                            {monoFont ? (
                              <FontStatusDot
                                name={monoFont}
                                uploadedNames={uploadedFontNames}
                              />
                            ) : null}
                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(480px-1.25rem)] p-0"
                          align="start"
                          sideOffset={2}
                          collisionPadding={8}
                          usePortal={false}
                        >
                          <Command>
                            <CommandInput
                              placeholder={t("popup.searchCodeFont")}
                            />
                            <CommandList className="max-h-[220px]">
                              <CommandEmpty>
                                {t("popup.noFontsFound")}
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value={t("popup.noCodeFont")}
                                  onSelect={clearMonoFont}
                                >
                                  <Check
                                    className={[
                                      "me-2 h-4 w-4 shrink-0",
                                      monoFont ? "opacity-0" : "opacity-100",
                                    ].join(" ")}
                                  />
                                  <span className="flex-1 truncate text-muted-foreground">
                                    {t("popup.noCodeFont")}
                                  </span>
                                </CommandItem>
                              </CommandGroup>
                              {monoFontOptions.map((group) =>
                                group.fonts.length > 0 ? (
                                  <CommandGroup
                                    key={group.heading}
                                    heading={group.heading}
                                  >
                                    {group.fonts.map((font) => (
                                      <CommandItem
                                        key={font}
                                        value={font}
                                        onSelect={() => chooseMonoFont(font)}
                                      >
                                        <Check
                                          className={[
                                            "me-2 h-4 w-4 shrink-0",
                                            font.toLowerCase() ===
                                            monoFont.toLowerCase()
                                              ? "opacity-100"
                                              : "opacity-0",
                                          ].join(" ")}
                                        />
                                        <span
                                          className="flex-1 truncate"
                                          style={{
                                            fontFamily: `'${font}', ui-monospace, monospace`,
                                          }}
                                        >
                                          {font}
                                        </span>
                                        <FontStatusDot
                                          name={font}
                                          uploadedNames={uploadedFontNames}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                ) : null,
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </section>

                  <Separator className="my-2" />

                  <section className="space-y-2.5">
                    <LabelWithHelp help={t("popup.typographyHelp")}>
                      {t("popup.typography")}
                    </LabelWithHelp>
                    {TYPOGRAPHY_CONTROLS.map((control) => {
                      const value = typography[control.field];
                      const disabled = !canApply || !fontEnabled;
                      const displayValue =
                        value ?? TYPOGRAPHY_FIELD_NEUTRAL[control.field];

                      return (
                        <div key={control.field} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label
                              htmlFor={`typography-${control.field}`}
                              className="text-xs text-muted-foreground"
                            >
                              {t(control.labelKey)}
                            </Label>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {value === null
                                  ? t("popup.typographyDefault")
                                  : control.format(value)}
                              </span>
                              {value !== null && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  disabled={disabled}
                                  aria-label={t("common.reset")}
                                  title={t("common.reset")}
                                  onClick={() =>
                                    persistTypography(control.field, null)
                                  }
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <input
                            id={`typography-${control.field}`}
                            type="range"
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={displayValue}
                            disabled={disabled}
                            onChange={(event) =>
                              persistTypography(
                                control.field,
                                Number(event.target.value),
                              )
                            }
                            className="w-full accent-[var(--fabric-denim)] disabled:opacity-50"
                          />
                        </div>
                      );
                    })}
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
                          className="relative rounded-full border border-[var(--fabric-stitch)] bg-[var(--fabric-linen)] px-2.5 py-0.5 text-xs font-medium shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.3)] fabric-stitch-pill"
                        >
                          {font.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <CustomFontManager onFontsChanged={reloadCustomFonts} />
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
                      {hostname && (
                        <Button
                          onClick={handlePopOutEditor}
                          variant="secondary"
                          size="sm"
                          className="gap-1 h-6 text-[10px] px-2"
                          title={t("options.popOutCss")}
                          aria-label={t("options.popOutCss")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {hostname && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-[var(--fabric-linen)] px-2 py-1.5">
                      <p className="min-w-0 text-[10px] text-muted-foreground">
                        {t("editor.editingFor")}{" "}
                        <span className="font-mono font-semibold">
                          {hostname}
                        </span>
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Label
                          htmlFor="css-enabled"
                          className="text-[10px] text-muted-foreground"
                        >
                          {t("editor.applyCss")}
                        </Label>
                        <Switch
                          id="css-enabled"
                          checked={cssEnabled}
                          onCheckedChange={handleCssEnabledToggle}
                          disabled={!canApply}
                        />
                      </div>
                    </div>
                  )}
                  {hostname && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-[var(--fabric-linen)] px-2 py-1.5">
                      <div className="flex min-w-0 items-center gap-1">
                        <p className="min-w-0 truncate text-[10px] text-muted-foreground">
                          {t("editor.includeSubdomains")}
                        </p>
                        <HelpTooltip
                          label={t("editor.includeSubdomains")}
                          help={t("editor.includeSubdomainsHelp", {
                            host: hostname,
                          })}
                        />
                      </div>
                      <Switch
                        id="include-subdomains"
                        checked={includeSubdomains}
                        onCheckedChange={handleIncludeSubdomainsToggle}
                        disabled={!canApply}
                      />
                    </div>
                  )}
                  <Suspense
                    fallback={
                      <div className="min-h-[160px] w-full rounded-lg border border-border bg-card shadow-fabric" />
                    }
                  >
                    <CssEditor
                      value={customCSS}
                      onChange={setCustomCSS}
                      readOnly={!canApply}
                      // A single line: CodeMirror renders the placeholder
                      // inside document line 1, so an embedded newline wraps
                      // there instead of becoming a second line - the gutter
                      // still reads "1" while four rows of grey text sit next
                      // to it, which looks like a broken editor.
                      placeholder={t("editor.cssPlaceholder")}
                    />
                  </Suspense>

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
                    {sourceHost === hostname && (
                      <Button
                        onClick={handleResetHost}
                        disabled={!canApply}
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("editor.resetHost")}
                      </Button>
                    )}
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label
                        htmlFor="auto-enable-all"
                        className="text-sm font-semibold"
                      >
                        {t("settings.autoEnableAllSites")}
                      </Label>
                      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                        {t("settings.autoEnableAllSitesHelp")}
                      </p>
                    </div>
                    <Switch
                      id="auto-enable-all"
                      checked={autoEnableAllSites}
                      onCheckedChange={handleAutoEnableToggle}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-semibold">
                      {t("settings.theme")}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("settings.themeHelp")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {THEME_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={
                              option.value === theme ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setTheme(option.value)}
                            className="gap-1.5 h-7 text-xs"
                            aria-pressed={option.value === theme}
                          >
                            <Icon className="h-3 w-3" />
                            {t(option.labelKey)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

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
                      {t("settings.manageSites")}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("settings.manageSitesHelp")}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2 gap-1.5 h-7 text-xs"
                      onClick={() => chrome.runtime.openOptionsPage()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("settings.manageSites")}
                    </Button>
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
