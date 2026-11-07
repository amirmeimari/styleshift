import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { defaultFilter } from "cmdk";
import {
  ArrowLeft,
  ChevronsUpDown,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe2,
  Info,
  Moon,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sun,
  SunMoon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { Card, CardContent } from "@/components/ui/card";
import { CustomFontManager } from "@/components/custom-font-manager";
import { FontPairing } from "@/components/font-pairing";
import { FontStatusDot } from "@/components/font-status-dot";
import { HelpTooltip } from "@/components/help";
import { useI18n } from "@/shared/i18n/use-i18n";
import { BUILTIN_FONTS, BUILTIN_MONO_FONT_NAMES } from "@/shared/builtin-fonts";
import { distinctFontNames, normalizeFontName } from "@/shared/font-stack";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  customFontFaces,
  getActiveTab,
  getHostname,
  hostMatchesPreset,
  isInjectableUrl,
  readAutoEnableAllSites,
  readCustomFonts,
  readGlobalCSS,
  readGlobalEnabled,
  readGlobalFontStack,
  readGlobalMonoFontStack,
  readHostSettings,
  readSavedFontNames,
  readTypography,
  requestReinject,
  resolveHostSettings,
  serializeFontStack,
  updateAutoEnableAllSites,
  updateGlobalCSS,
  updateGlobalEnabled,
  updateGlobalFontStack,
  updateGlobalMonoFontStack,
  updateHostSettings,
  updateTypography,
} from "@/shared/styleshift";
import { formatCSS } from "@/css-editor/format-css";
import {
  createCssDrafts,
  discardCssDraft,
  isCssDraftDirty,
  markCssSaved,
  replaceCssScope,
  updateCssDraft,
  type CssScope,
} from "./css-workflow";
// CodeMirror is by far the largest dependency in the popup and only the CSS
// tab needs it, so it is split into its own chunk and fetched on first use.
// The chunk is served from the extension itself, so this costs no network.
const CssEditor = lazy(() =>
  import("@/css-editor/css-editor").then((module) => ({
    default: module.CssEditor,
  })),
);

type TabId = "fonts" | "upload" | "css" | "settings" | "about";

const PRIMARY_TABS: {
  id: Exclude<TabId, "settings" | "about">;
  labelKey: string;
}[] = [
  { id: "fonts", labelKey: "tabs.fonts" },
  { id: "css", labelKey: "tabs.css" },
  { id: "upload", labelKey: "tabs.library" },
];

// Seven columns keep every shortcut reachable without horizontal clipping in
// the compact popup shell.
const PRESET_COLUMN_COUNT = 7;

type TypographyField = "lineHeight" | "letterSpacing" | "fontWeight";
type FontView = "pairing" | "typography";
type SaveState = "idle" | "saving" | "saved" | "error";

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
  const popupScrollRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  // One stable setter per tab, created once - PRIMARY_TABS is module-level
  // constant, so this never needs to change across renders. An inline
  // `ref={(el) => ...}` in the JSX below would instead reallocate on every
  // render of this always-mounted nav, including on every CSS-editor
  // keystroke.
  const tabRefSetters = useMemo(
    () =>
      Object.fromEntries(
        PRIMARY_TABS.map((tab) => [
          tab.id,
          (el: HTMLButtonElement | null) => {
            tabRefs.current[tab.id] = el;
          },
        ]),
      ) as Record<TabId, (el: HTMLButtonElement | null) => void>,
    [],
  );
  const [hostname, setHostname] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [fontFamily, setFontFamily] = useState(DEFAULT_SETTINGS.fontFamily);
  const [fontStack, setFontStack] = useState<string[]>([]);
  const [savedTextFontNames, setSavedTextFontNames] = useState<string[]>([]);
  const [savedCodeFontNames, setSavedCodeFontNames] = useState<string[]>([]);
  // The raw family name ("Fira Code"), never the serialized CSS value
  // (`"Fira Code"` with quotes). Serialization happens only at the storage
  // boundary in persistMonoFont, so nothing renders stray quote marks.
  const [monoFont, setMonoFont] = useState(DEFAULT_SETTINGS.monoFontFamily);
  const [fontEnabled, setFontEnabled] = useState(DEFAULT_SETTINGS.fontEnabled);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [monoFontComboboxOpen, setMonoFontComboboxOpen] = useState(false);
  const [monoFontDraft, setMonoFontDraft] = useState("");
  const [fontView, setFontView] = useState<FontView>("pairing");
  const [fontSaveState, setFontSaveState] = useState<SaveState>("idle");
  const fontSaveGeneration = useRef(0);
  const fontStackGeneration = useRef(0);
  const monoFontGeneration = useRef(0);
  const typographyGeneration = useRef(0);
  const persistedStack = useRef<string[]>([]);
  const persistedMono = useRef("");
  const persistedTypography = useRef(DEFAULT_TYPOGRAPHY);
  const [librarySearch, setLibrarySearch] = useState("");
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
  const [cssScope, setCssScope] = useState<CssScope>("site");
  const [cssDrafts, setCssDrafts] = useState(() => createCssDrafts());
  const [cssSaveStates, setCssSaveStates] = useState<
    Record<CssScope, SaveState>
  >({ site: "idle", global: "idle" });
  const [cssCopyStates, setCssCopyStates] = useState<
    Record<CssScope, "idle" | "copied" | "error">
  >({ site: "idle", global: "idle" });
  const [autoEnableAllSites, setAutoEnableAllSites] = useState(false);
  const [typography, setTypography] =
    useState<TypographySettings>(DEFAULT_TYPOGRAPHY);
  const { locale, setLocale } = useI18n();
  const uploadedFontNames = useMemo(
    () => Object.values(customFonts).map((font) => font.name),
    [customFonts],
  );
  const customFontCss = useMemo(
    () => customFontFaces(customFonts),
    [customFonts],
  );
  const filteredBuiltinFonts = useMemo(() => {
    const query = librarySearch.trim().toLocaleLowerCase();
    return BUILTIN_FONTS.filter((font) =>
      font.name.toLocaleLowerCase().includes(query),
    );
  }, [librarySearch]);
  const presetColumns = useMemo(() => {
    // Matches the seven-column layout below. Round-robin (not a fixed-size
    // slice per column) so every column stays populated regardless of the
    // preset count - a slice-based split leaves trailing columns empty
    // whenever the count isn't an exact multiple of PRESET_COLUMN_COUNT.
    const columns: (typeof POPULAR_SITE_PRESETS)[number][][] = Array.from(
      { length: PRESET_COLUMN_COUNT },
      () => [],
    );
    POPULAR_SITE_PRESETS.forEach((preset, index) => {
      columns[index % PRESET_COLUMN_COUNT].push(preset);
    });
    return columns.filter((column) => column.length > 0);
  }, []);

  const monoFontOptions = useMemo(
    () => [
      {
        heading: t("popup.savedFonts"),
        fonts: distinctFontNames(
          [monoFont, ...savedCodeFontNames],
          [...BUILTIN_MONO_FONT_NAMES, ...uploadedFontNames],
        ),
      },
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
    [t, monoFont, savedCodeFontNames, uploadedFontNames],
  );
  const typedMonoFont = normalizeFontName(monoFontDraft);
  const monoFontQuery = monoFontDraft.trim().toLocaleLowerCase();
  const showTypedMonoFont =
    Boolean(typedMonoFont) &&
    !monoFontOptions.some((group) =>
      group.fonts.some((font) => font.toLocaleLowerCase() === monoFontQuery),
    );

  const canApply = useMemo(
    () => Boolean(hostname) && globalEnabled,
    [globalEnabled, hostname],
  );

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        // Global font/library/preferences remain useful on restricted pages;
        // only host-specific controls need an injectable http(s) tab.
        const tab = await getActiveTab({ allowRestricted: true });
        const host = isInjectableUrl(tab.url) ? getHostname(tab.url) : "";

        const [
          resolved,
          enabled,
          hydratedFontStack,
          hydratedMonoFontStack,
          storedFontNames,
          fonts,
          storedTypography,
          storedGlobalCSS,
          storedAutoEnable,
        ] = await Promise.all([
          host ? resolveHostSettings(host) : Promise.resolve(null),
          readGlobalEnabled(),
          readGlobalFontStack(),
          readGlobalMonoFontStack(),
          readSavedFontNames(),
          readCustomFonts(),
          readTypography(),
          readGlobalCSS(),
          readAutoEnableAllSites(),
        ]);
        const settings = resolved?.settings ?? DEFAULT_SETTINGS;
        // Use the same shared readers as injection: absent keys mean no text
        // override and the default code font; explicit [] means no override.
        // Legacy host fields stay stored, but never select a shared pairing.
        const hydratedFontFamily = serializeFontStack(hydratedFontStack);
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
        setFontStack(hydratedFontStack);
        persistedStack.current = hydratedFontStack;
        setSavedTextFontNames(storedFontNames.text);
        setSavedCodeFontNames(storedFontNames.code);
        setFontFamily(hydratedFontFamily);
        setMonoFont(hydratedMonoFont);
        persistedMono.current = hydratedMonoFont;
        setFontEnabled(settings.fontEnabled);
        setGlobalEnabled(enabled);
        setCustomFonts(fonts);
        setPresetStates(Object.fromEntries(presetEntries));
        setCssEnabled(settings.cssEnabled !== false);
        setSourceHost(resolved?.sourceHost ?? null);
        setIncludeSubdomains(settings.includeSubdomains !== false);
        setCssDrafts(createCssDrafts(settings.customCSS, storedGlobalCSS));
        setTypography(storedTypography);
        persistedTypography.current = storedTypography;
        setAutoEnableAllSites(storedAutoEnable);
        setLoaded(true);
      } catch (error) {
        console.error(error);
        if (mounted) setLoadError(true);
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  // A disclosure button near the bottom can be auto-scrolled into view before
  // its click fires. Reset the popup scroll after changing tabs/subviews so a
  // newly opened screen always starts at its own heading.
  useEffect(() => {
    popupScrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab, fontView]);

  // Merges `patch` onto hostname's own record and persists + reinjects the
  // result. When hostname has no own record yet (it's inheriting from an
  // ancestor, or has nothing), the base is DEFAULT_SETTINGS with only the
  // resolved fontEnabled fallback carried over - never the ancestor's other
  // fields. Spreading the ancestor's full resolved settings here (as this
  // used to) would freeze a permanent copy of its customCSS/fontFamily onto
  // the child the moment the user touched any unrelated switch, silently
  // forking it off future changes to the parent - the same domain-boundary
  // leak handlePresetToggle already guards against below.
  async function saveAndInject(patch: Partial<StyleShiftSettings>) {
    if (!hostname) {
      return;
    }

    const resolved = await resolveHostSettings(hostname);
    const base =
      resolved.sourceHost === hostname
        ? resolved.settings
        : { ...DEFAULT_SETTINGS, fontEnabled: resolved.settings.fontEnabled };
    const next = { ...base, ...patch };
    await updateHostSettings(hostname, next);
    // Writing here always materializes hostname's own record.
    setSourceHost(hostname);
    setCssEnabled(next.cssEnabled !== false);
    setIncludeSubdomains(next.includeSubdomains !== false);
    setCssDrafts((drafts) =>
      isCssDraftDirty(drafts, "site")
        ? markCssSaved(drafts, "site", next.customCSS)
        : replaceCssScope(drafts, "site", next.customCSS),
    );

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
    const previous = globalEnabled;
    setActionError(false);
    setGlobalEnabled(checked);
    try {
      await updateGlobalEnabled(checked);
    } catch {
      setGlobalEnabled(previous);
      setActionError(true);
    }
  }

  function beginFontSave(): number {
    const generation = ++fontSaveGeneration.current;
    setFontSaveState("saving");
    return generation;
  }

  function finishFontSave(generation: number, state: SaveState) {
    if (fontSaveGeneration.current === generation) {
      setFontSaveState(state);
    }
  }

  async function persistFontStack(nextFontStack: string[]) {
    const nextFontFamily = serializeFontStack(nextFontStack);
    const stackGeneration = ++fontStackGeneration.current;
    const generation = beginFontSave();

    setFontStack(nextFontStack);
    setFontFamily(nextFontFamily);
    try {
      setSavedTextFontNames(
        await updateGlobalFontStack(nextFontStack, uploadedFontNames),
      );
      persistedStack.current = nextFontStack;
    } catch (error) {
      console.error("Error saving font stack:", error);
      if (fontStackGeneration.current === stackGeneration) {
        setFontStack(persistedStack.current);
        setFontFamily(serializeFontStack(persistedStack.current));
      }
      finishFontSave(generation, "error");
      return;
    }

    // The global key is authoritative for injection, hydration and backups.
    // Mirroring it into a host record can restore a stale site enable flag
    // after a concurrent toggle and is unnecessary once this key exists.
    finishFontSave(generation, "saved");
  }

  async function persistMonoFont(nextFont: string) {
    const nextStack = nextFont ? [nextFont] : [];
    const monoGeneration = ++monoFontGeneration.current;
    const generation = beginFontSave();

    setMonoFont(nextFont);
    try {
      setSavedCodeFontNames(
        await updateGlobalMonoFontStack(nextStack, uploadedFontNames),
      );
      persistedMono.current = nextFont;
    } catch (error) {
      console.error("Error saving code font:", error);
      if (monoFontGeneration.current === monoGeneration) {
        setMonoFont(persistedMono.current);
      }
      finishFontSave(generation, "error");
      return;
    }

    finishFontSave(generation, "saved");
  }

  function changeMonoFontPickerOpen(open: boolean) {
    setMonoFontComboboxOpen(open);
    if (!open) setMonoFontDraft("");
  }

  async function chooseMonoFont(fontName: string) {
    const nextFont = normalizeFontName(fontName);
    if (!nextFont) {
      return;
    }

    changeMonoFontPickerOpen(false);
    await persistMonoFont(nextFont);
  }

  async function clearMonoFont() {
    changeMonoFontPickerOpen(false);
    await persistMonoFont("");
  }

  async function handleFontToggle(checked: boolean) {
    const previous = fontEnabled;
    const previousPresets = presetStates;
    setActionError(false);
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

    try {
      await saveAndInject({
        fontEnabled: checked,
      });
    } catch {
      setFontEnabled(previous);
      setPresetStates(previousPresets);
      setActionError(true);
    }
  }

  async function handlePresetToggle(host: string) {
    setActionError(false);
    try {
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
          fontEnabled: next,
        });
      }

      try {
        const tab = await getActiveTab();
        await requestReinject(tab.id);
      } catch (error) {
        console.error(error);
      }
    } catch {
      setActionError(true);
    }
  }

  async function persistTypography(
    field: keyof TypographySettings,
    value: number | null,
  ) {
    // Optimistic update - the storage.onChanged listener in content.ts
    // reapplies the page's styling on its own, so no reinject nudge is
    // needed here (same pattern as persistFontStack/persistMonoFont).
    const currentTypographyGeneration = ++typographyGeneration.current;
    const generation = beginFontSave();
    setTypography((current) => ({ ...current, [field]: value }));
    try {
      const next = await updateTypography({ [field]: value });
      persistedTypography.current = next;
      if (typographyGeneration.current === currentTypographyGeneration) {
        setTypography(next);
      }
      finishFontSave(generation, "saved");
    } catch (error) {
      console.error("Error saving typography:", error);
      if (typographyGeneration.current === currentTypographyGeneration) {
        setTypography(persistedTypography.current);
      }
      finishFontSave(generation, "error");
    }
  }

  async function resetTypography() {
    const currentTypographyGeneration = ++typographyGeneration.current;
    const generation = beginFontSave();
    setTypography(DEFAULT_TYPOGRAPHY);
    try {
      const next = await updateTypography(DEFAULT_TYPOGRAPHY);
      persistedTypography.current = next;
      if (typographyGeneration.current === currentTypographyGeneration) {
        setTypography(next);
      }
      finishFontSave(generation, "saved");
    } catch (error) {
      console.error("Error resetting typography:", error);
      if (typographyGeneration.current === currentTypographyGeneration) {
        setTypography(persistedTypography.current);
      }
      finishFontSave(generation, "error");
    }
  }

  async function handleAutoEnableToggle(checked: boolean) {
    const previous = autoEnableAllSites;
    setActionError(false);
    setAutoEnableAllSites(checked);
    try {
      await updateAutoEnableAllSites(checked);
    } catch {
      setAutoEnableAllSites(previous);
      setActionError(true);
    }
  }

  async function reloadCustomFonts() {
    const fonts = await readCustomFonts();
    setCustomFonts(fonts);
  }

  async function handleCssEnabledToggle(checked: boolean) {
    try {
      await saveAndInject({
        cssEnabled: checked,
        customCSS: cssDrafts.site.saved,
      });
      setCssEnabled(checked);
      setCssSaveStates((state) => ({ ...state, site: "saved" }));
    } catch (error) {
      console.error("Error toggling site CSS:", error);
      setCssSaveStates((state) => ({ ...state, site: "error" }));
    }
  }

  async function handleSaveCSS() {
    const scope = cssScope;
    const value = cssDrafts[scope].draft;
    if (scope === "site" && !hostname) return;
    setCssSaveStates((state) => ({ ...state, [scope]: "saving" }));
    try {
      if (scope === "global") {
        await updateGlobalCSS(value);
      } else {
        await saveAndInject({ customCSS: value });
      }
      setCssDrafts((drafts) => markCssSaved(drafts, scope, value));
      setCssSaveStates((state) => ({ ...state, [scope]: "saved" }));
    } catch (error) {
      console.error("Error saving CSS:", error);
      setCssSaveStates((state) => ({ ...state, [scope]: "error" }));
    }
  }

  async function handleRemoveCSS() {
    const scope = cssScope;
    if (scope === "site" && !hostname) return;
    setCssSaveStates((state) => ({ ...state, [scope]: "saving" }));
    try {
      if (scope === "global") await updateGlobalCSS("");
      else await saveAndInject({ customCSS: "" });
      setCssDrafts((drafts) => replaceCssScope(drafts, scope, ""));
      setCssSaveStates((state) => ({ ...state, [scope]: "saved" }));
    } catch (error) {
      console.error("Error removing CSS:", error);
      setCssSaveStates((state) => ({ ...state, [scope]: "error" }));
    }
  }

  async function handleIncludeSubdomainsToggle(checked: boolean) {
    try {
      await saveAndInject({
        includeSubdomains: checked,
        customCSS: cssDrafts.site.saved,
      });
      setIncludeSubdomains(checked);
      setCssSaveStates((state) => ({ ...state, site: "saved" }));
    } catch (error) {
      console.error("Error changing subdomain inheritance:", error);
      setCssSaveStates((state) => ({ ...state, site: "error" }));
    }
  }

  // Drops hostname's own record so it falls back to whatever it would
  // otherwise inherit (or to defaults, if nothing does).
  async function handleResetHost() {
    if (!hostname) {
      return;
    }
    if (
      isCssDraftDirty(cssDrafts, "site") &&
      !window.confirm(t("editor.discardSiteDraft"))
    )
      return;

    try {
      await clearHostSettings(hostname);
      const resolved = await resolveHostSettings(hostname);
      const settings = resolved.settings;

      setSourceHost(resolved.sourceHost);
      setFontEnabled(settings.fontEnabled);
      setCssEnabled(settings.cssEnabled !== false);
      setIncludeSubdomains(settings.includeSubdomains !== false);
      setCssDrafts((drafts) =>
        replaceCssScope(drafts, "site", settings.customCSS),
      );
      setCssSaveStates((state) => ({ ...state, site: "saved" }));

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
    } catch (error) {
      console.error("Error resetting site:", error);
      setCssSaveStates((state) => ({ ...state, site: "error" }));
    }
  }

  // The popup is 420px wide and closes the instant it loses focus, which is
  // why import's file picker (and any serious editing) has to live on the
  // options page instead - open it pre-scoped to this host.
  function handlePopOutEditor() {
    if (
      typeof chrome === "undefined" ||
      !chrome.tabs ||
      (cssScope === "site" && !hostname)
    ) {
      return;
    }
    if (
      isCssDraftDirty(cssDrafts, cssScope) &&
      !window.confirm(t("editor.fullEditorDraftWarning"))
    )
      return;
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        cssScope === "site"
          ? `options.html?host=${encodeURIComponent(hostname)}`
          : "options.html?css=global",
      ),
    });
  }

  const hasChanges = isCssDraftDirty(cssDrafts, cssScope);
  const currentCss = cssDrafts[cssScope];
  const cssBusy = cssSaveStates[cssScope] === "saving";
  const hasActivePrimaryTab = PRIMARY_TABS.some((tab) => tab.id === activeTab);

  function handleTabsKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const activeIndex = PRIMARY_TABS.findIndex((tab) => tab.id === activeTab);
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex =
        (currentIndex + (dir === "rtl" ? -1 : 1) + PRIMARY_TABS.length) %
        PRIMARY_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex + (dir === "rtl" ? 1 : -1) + PRIMARY_TABS.length) %
        PRIMARY_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PRIMARY_TABS.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = PRIMARY_TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  }

  if (!loaded)
    return (
      <main dir={dir} className="p-4 text-sm">
        <p role={loadError ? "alert" : "status"}>
          {t(loadError ? "settings.loadError" : "settings.loading")}
        </p>
        {loadError && (
          <Button className="mt-3" onClick={() => window.location.reload()}>
            {t("common.retry")}
          </Button>
        )}
      </main>
    );

  return (
    <main
      dir={dir}
      ref={popupScrollRef}
      className="max-h-[600px] w-full max-w-[420px] overflow-y-auto overflow-x-hidden bg-background text-foreground"
    >
      {customFontCss && <style>{customFontCss}</style>}
      <Card className="rounded-none border-0 bg-transparent shadow-none">
        <CardContent className="p-0">
          <div>
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
              <header className="flex h-14 items-center justify-between border-b border-border px-4">
                <div
                  className="flex min-w-0 items-center gap-2.5"
                  aria-label="StyleShift"
                >
                  <BrandIcon />
                  <span className="truncate text-lg font-bold tracking-tight">
                    StyleShift
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={
                    activeTab === "settings" || activeTab === "about"
                      ? "bg-accent text-accent-foreground"
                      : ""
                  }
                  aria-label={t("tabs.settings")}
                  title={t("tabs.settings")}
                  aria-pressed={
                    activeTab === "settings" || activeTab === "about"
                  }
                  onClick={() => setActiveTab("settings")}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </header>

              <section className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Globe2
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <bdi
                      className="block truncate text-sm font-semibold"
                      dir="ltr"
                    >
                      {hostname || t("popup.restrictedPage")}
                    </bdi>
                    {!globalEnabled && (
                      <span className="block text-[11px] text-muted-foreground">
                        {t("popup.globalOff")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label
                    htmlFor="site-font-enabled"
                    className="text-xs text-muted-foreground"
                  >
                    {t("popup.siteFonts")}
                  </Label>
                  <Switch
                    id="site-font-enabled"
                    checked={fontEnabled}
                    onCheckedChange={handleFontToggle}
                    disabled={!canApply}
                    aria-label={t("popup.siteFonts")}
                  />
                </div>
              </section>

              <nav
                role="tablist"
                aria-orientation="horizontal"
                onKeyDown={handleTabsKeyDown}
                className="grid h-12 grid-cols-3 border-b border-border px-2"
              >
                {PRIMARY_TABS.map((tab, index) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={tabRefSetters[tab.id]}
                      id={`tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="styleshift-tabpanel"
                      tabIndex={
                        isActive || (!hasActivePrimaryTab && index === 0)
                          ? 0
                          : -1
                      }
                      className={[
                        "relative flex items-center justify-center px-3 text-sm font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isActive
                          ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary"
                          : "hover:text-foreground",
                      ].join(" ")}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {t(tab.labelKey)}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div
              id="styleshift-tabpanel"
              role="tabpanel"
              aria-labelledby={
                hasActivePrimaryTab ? `tab-${activeTab}` : undefined
              }
              aria-label={
                activeTab === "settings"
                  ? t("tabs.settings")
                  : activeTab === "about"
                    ? t("tabs.about")
                    : undefined
              }
              tabIndex={0}
              className="relative min-h-[260px] bg-background p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {actionError && (
                <p role="alert" className="mb-3 text-xs text-destructive">
                  {t("settings.saveError")}
                </p>
              )}
              {activeTab === "fonts" && (
                <section className="space-y-3">
                  {fontView === "pairing" ? (
                    <>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h1 className="text-xl font-bold tracking-tight">
                            {t("popup.fontPairing")}
                          </h1>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("popup.orderedStack")}
                          </p>
                        </div>
                        <span className="max-w-[150px] text-end text-[11px] leading-tight text-muted-foreground">
                          {t("popup.sharedAcrossSites")}
                        </span>
                      </div>

                      <FontPairing
                        fontStack={fontStack}
                        savedFontNames={savedTextFontNames}
                        uploadedFontNames={uploadedFontNames}
                        disabled={!globalEnabled}
                        busy={fontSaveState === "saving"}
                        onChange={persistFontStack}
                      />

                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {t("popup.fallbackExplanation")}
                      </p>

                      <div className="rounded-lg border border-primary/10 bg-accent p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("popup.preview")}
                        </span>
                        <div
                          className="mt-2 border-s-2 border-primary ps-3"
                          style={{
                            fontFamily: fontFamily || undefined,
                            lineHeight: typography.lineHeight ?? 1.45,
                            letterSpacing:
                              typography.letterSpacing === null
                                ? undefined
                                : `${typography.letterSpacing}em`,
                            fontWeight: typography.fontWeight ?? 700,
                          }}
                        >
                          <p dir="ltr" lang="en" className="text-start text-xl">
                            The web, your way.
                          </p>
                          <p
                            dir="rtl"
                            lang="fa"
                            className="mt-1 text-start text-lg"
                          >
                            وب، به سبک تو
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="flex min-h-11 items-center gap-3 border-b border-border px-3">
                          <Label
                            htmlFor="mono-font-family"
                            className="shrink-0 text-sm font-semibold"
                          >
                            {t("popup.codeFont")}
                          </Label>
                          <Popover
                            open={monoFontComboboxOpen}
                            onOpenChange={changeMonoFontPickerOpen}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id="mono-font-family"
                                type="button"
                                variant="ghost"
                                role="combobox"
                                aria-expanded={monoFontComboboxOpen}
                                className="ms-auto h-9 min-w-0 max-w-[230px] gap-2 px-1.5 font-normal"
                                disabled={!globalEnabled}
                              >
                                <span
                                  className="truncate text-sm"
                                  style={{
                                    fontFamily: monoFont
                                      ? `${serializeFontStack([monoFont])}, ui-monospace, monospace`
                                      : undefined,
                                  }}
                                >
                                  {monoFont || t("popup.pickCodeFont")}
                                </span>
                                {monoFont && (
                                  <FontStatusDot
                                    name={monoFont}
                                    uploadedNames={uploadedFontNames}
                                  />
                                )}
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[330px] max-w-[calc(420px-2rem)] p-[7px]"
                              align="end"
                              sideOffset={4}
                              collisionPadding={8}
                              usePortal={false}
                            >
                              <Command
                                label={t("popup.searchOrTypeFont")}
                                filter={(value, search, keywords) =>
                                  defaultFilter(value, search.trim(), keywords)
                                }
                              >
                                <CommandInput
                                  placeholder={t("popup.searchOrTypeFont")}
                                  value={monoFontDraft}
                                  onValueChange={setMonoFontDraft}
                                />
                                <CommandList className="max-h-[220px]">
                                  <CommandEmpty>
                                    {t("popup.noFontsFound")}
                                  </CommandEmpty>
                                  {showTypedMonoFont && (
                                    <CommandItem
                                      value={`local:${monoFontDraft.trim()}`}
                                      keywords={[monoFontDraft]}
                                      onSelect={() =>
                                        chooseMonoFont(typedMonoFont)
                                      }
                                    >
                                      <span className="me-2 shrink-0 text-muted-foreground">
                                        {t("popup.addFont")}
                                      </span>{" "}
                                      <span className="min-w-0 flex-1 truncate">
                                        {typedMonoFont}
                                      </span>
                                    </CommandItem>
                                  )}
                                  <CommandGroup>
                                    <CommandItem
                                      value={t("popup.noCodeFont")}
                                      onSelect={clearMonoFont}
                                    >
                                      <Check
                                        className={`me-2 h-4 w-4 ${monoFont ? "opacity-0" : "opacity-100"}`}
                                      />
                                      <span className="flex-1 text-muted-foreground">
                                        {t("popup.noCodeFont")}
                                      </span>
                                    </CommandItem>
                                  </CommandGroup>
                                  {monoFontOptions.map((group) =>
                                    group.fonts.length ? (
                                      <CommandGroup
                                        key={group.heading}
                                        heading={group.heading}
                                      >
                                        {group.fonts.map((font) => (
                                          <CommandItem
                                            key={font}
                                            value={font}
                                            onSelect={() =>
                                              chooseMonoFont(font)
                                            }
                                          >
                                            <Check
                                              className={`me-2 h-4 w-4 ${font.toLocaleLowerCase() === monoFont.toLocaleLowerCase() ? "opacity-100" : "opacity-0"}`}
                                            />
                                            <span
                                              className="flex-1 truncate"
                                              style={{
                                                fontFamily: `${serializeFontStack([font])}, ui-monospace, monospace`,
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
                        <button
                          type="button"
                          className="flex min-h-11 w-full items-center gap-3 px-3 text-start transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          onClick={() => setFontView("typography")}
                        >
                          <span className="text-sm font-semibold">
                            {t("popup.typography")}
                          </span>
                          <span className="ms-auto truncate text-xs text-muted-foreground">
                            {t("popup.typographySummary", {
                              lineHeight:
                                typography.lineHeight ??
                                t("popup.typographyDefault"),
                              weight:
                                typography.fontWeight ??
                                t("popup.typographyDefault"),
                            })}
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>

                      <details className="rounded-lg border border-border bg-card px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {t("popup.quickSites")}
                        </summary>
                        <div className="mt-2 grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1">
                          {presetColumns.map((column, columnIndex) => (
                            <div
                              key={columnIndex}
                              className="flex flex-col items-center gap-1"
                            >
                              {column.map((preset) => {
                                const active =
                                  presetStates[preset.host] ?? true;
                                return (
                                  <Button
                                    key={preset.host}
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className={`relative h-10 w-10 overflow-hidden p-0 ${active ? "border-primary/35 bg-accent" : "opacity-50"}`}
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
                                        src={chrome.runtime.getURL(
                                          `icons/presets/${preset.svgIcon}.svg`,
                                        )}
                                        alt=""
                                        className={`h-6 w-6 object-contain${preset.monochrome ? " dark:invert" : ""}`}
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
                        {sourceHost && sourceHost !== hostname && (
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            {t("popup.inheritedFrom", { host: sourceHost })}
                          </p>
                        )}
                      </details>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-sm text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setFontView("pairing")}
                      >
                        <ArrowLeft
                          className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}
                        />
                        {t("tabs.fonts")}
                      </button>
                      <h1 className="text-xl font-bold tracking-tight">
                        {t("popup.typography")}
                      </h1>

                      <div className="rounded-lg border border-primary/10 bg-accent p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("popup.preview")}
                        </span>
                        <div
                          className="mt-2 border-s-2 border-primary ps-3"
                          style={{
                            fontFamily: fontFamily || undefined,
                            lineHeight: typography.lineHeight ?? 1.45,
                            letterSpacing:
                              typography.letterSpacing === null
                                ? undefined
                                : `${typography.letterSpacing}em`,
                            fontWeight: typography.fontWeight ?? 700,
                          }}
                        >
                          <p dir="ltr" lang="en" className="text-start text-xl">
                            The web, your way.
                          </p>
                          <p
                            dir="rtl"
                            lang="fa"
                            className="mt-1 text-start text-lg"
                          >
                            وب، به سبک تو
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {TYPOGRAPHY_CONTROLS.map((control) => {
                          const value = typography[control.field];
                          const displayValue =
                            value ?? TYPOGRAPHY_FIELD_NEUTRAL[control.field];
                          return (
                            <div
                              key={control.field}
                              className="space-y-2 border-b border-border p-3 last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <Label
                                  htmlFor={`typography-${control.field}`}
                                  className="text-sm font-semibold"
                                >
                                  {t(control.labelKey)}
                                </Label>
                                <div className="flex items-center gap-1">
                                  <span className="rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-muted-foreground">
                                    {value === null
                                      ? t("popup.typographyDefault")
                                      : control.format(value)}
                                  </span>
                                  {value !== null && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      aria-label={`${t("common.reset")}: ${t(control.labelKey)}`}
                                      onClick={() =>
                                        persistTypography(control.field, null)
                                      }
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
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
                                disabled={!globalEnabled}
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
                        <div className="space-y-2 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <Label
                                htmlFor="typography-minFontSize"
                                className="text-sm font-semibold"
                              >
                                {t("options.minFontSizeTitle")}
                              </Label>
                              <p className="text-[10px] leading-tight text-muted-foreground">
                                {t("popup.minFontSizeScope")}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-muted-foreground">
                                {typography.minFontSize === null
                                  ? t("popup.typographyDefault")
                                  : `${typography.minFontSize}px`}
                              </span>
                              {typography.minFontSize !== null && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={`${t("common.reset")}: ${t("options.minFontSizeTitle")}`}
                                  onClick={() =>
                                    persistTypography("minFontSize", null)
                                  }
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <input
                            id="typography-minFontSize"
                            type="range"
                            min={TYPOGRAPHY_RANGES.minFontSize.min}
                            max={TYPOGRAPHY_RANGES.minFontSize.max}
                            step={1}
                            value={
                              typography.minFontSize ??
                              TYPOGRAPHY_RANGES.minFontSize.min
                            }
                            onChange={(event) =>
                              persistTypography(
                                "minFontSize",
                                Number(event.target.value),
                              )
                            }
                            className="w-full accent-[var(--fabric-denim)]"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={resetTypography}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("popup.resetTypography")}
                      </Button>
                    </>
                  )}

                  <div
                    role={fontSaveState === "error" ? "alert" : "status"}
                    className={`flex min-h-7 items-center gap-1.5 border-t border-border pt-2 text-xs ${fontSaveState === "error" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {fontSaveState === "saved" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {fontSaveState === "saving"
                      ? t("popup.savingAutomatically")
                      : fontSaveState === "saved"
                        ? t("popup.savedAutomatically")
                        : fontSaveState === "error"
                          ? t("popup.saveError")
                          : t("popup.autosaveHint")}
                  </div>
                </section>
              )}

              {activeTab === "upload" && (
                <section className="space-y-3">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight">
                      {t("fonts.libraryTitle")}
                    </h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("fonts.librarySubtitle")}
                    </p>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      value={librarySearch}
                      onChange={(event) => setLibrarySearch(event.target.value)}
                      placeholder={t("fonts.search")}
                      aria-label={t("fonts.search")}
                      className="ps-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fonts.bundledTitle")}
                    </Label>
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      {filteredBuiltinFonts.map((font) => (
                        <div
                          key={font.name}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
                        >
                          <span
                            className="truncate text-sm font-semibold"
                            style={{ fontFamily: `'${font.name}', sans-serif` }}
                          >
                            {font.name}
                          </span>
                          <span
                            className="text-xl"
                            aria-hidden="true"
                            style={{ fontFamily: `'${font.name}', sans-serif` }}
                          >
                            Aa
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <FontStatusDot
                              name={font.name}
                              uploadedNames={uploadedFontNames}
                            />
                            {t("fonts.bundledStatus")}
                          </span>
                        </div>
                      ))}
                      {filteredBuiltinFonts.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          {t("fonts.noBundledMatches")}
                        </p>
                      )}
                    </div>
                  </div>

                  <CustomFontManager
                    searchQuery={librarySearch}
                    onFontsChanged={reloadCustomFonts}
                  />
                </section>
              )}

              {activeTab === "css" && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-xl font-bold tracking-tight">
                      {t("editor.customCSS")}
                    </h1>
                    <div
                      role="group"
                      aria-label={t("editor.cssScope")}
                      className="inline-flex rounded-md border border-border p-0.5"
                    >
                      {(["site", "global"] as const).map((scope) => (
                        <button
                          key={scope}
                          type="button"
                          aria-pressed={cssScope === scope}
                          onClick={() => setCssScope(scope)}
                          className={`rounded px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cssScope === scope ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {t(
                            scope === "site"
                              ? "editor.thisSite"
                              : "editor.allSites",
                          )}
                          {isCssDraftDirty(cssDrafts, scope) ? " •" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                  {cssScope === "global" && (
                    <p className="text-xs text-muted-foreground">
                      {t("editor.globalCssScopeHelp")}
                    </p>
                  )}
                  {cssScope === "site" && (
                    <p className="text-xs text-muted-foreground">
                      {hostname ? (
                        <>
                          <bdi dir="ltr">{hostname}</bdi>
                          {sourceHost && sourceHost !== hostname
                            ? ` · ${t("popup.inheritedFrom", { host: sourceHost })}`
                            : ""}
                        </>
                      ) : (
                        t("editor.siteUnavailable")
                      )}
                    </p>
                  )}
                  {cssScope === "site" && hostname && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-[var(--fabric-linen)] px-2 py-1.5">
                      <p className="min-w-0 text-xs text-muted-foreground">
                        {t("editor.editingFor")}{" "}
                        <span className="font-mono font-semibold">
                          {hostname}
                        </span>
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Label
                          htmlFor="css-enabled"
                          className="text-xs text-muted-foreground"
                        >
                          {t("editor.siteCssEnabled")}
                        </Label>
                        <Switch
                          id="css-enabled"
                          checked={cssEnabled}
                          onCheckedChange={handleCssEnabledToggle}
                          disabled={!canApply || cssBusy}
                        />
                      </div>
                    </div>
                  )}
                  {cssScope === "site" && hostname && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-[var(--fabric-linen)] px-2 py-1.5">
                      <div className="flex min-w-0 items-center gap-1">
                        <p className="min-w-0 truncate text-xs text-muted-foreground">
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
                        aria-label={t("editor.includeSubdomains")}
                        checked={includeSubdomains}
                        onCheckedChange={handleIncludeSubdomainsToggle}
                        disabled={!canApply || cssBusy}
                      />
                    </div>
                  )}
                  <Suspense
                    fallback={
                      <div className="min-h-[160px] w-full rounded-lg border border-border bg-card shadow-fabric" />
                    }
                  >
                    <CssEditor
                      key={cssScope}
                      value={currentCss.draft}
                      ariaLabel={t(
                        cssScope === "site"
                          ? "editor.thisSite"
                          : "editor.allSites",
                      )}
                      onChange={(value) => {
                        setCssDrafts((drafts) =>
                          updateCssDraft(drafts, cssScope, value),
                        );
                        setCssSaveStates((states) => ({
                          ...states,
                          [cssScope]: "idle",
                        }));
                      }}
                      readOnly={
                        cssBusy ||
                        !globalEnabled ||
                        (cssScope === "site" && !hostname)
                      }
                      // A single line: CodeMirror renders the placeholder
                      // inside document line 1, so an embedded newline wraps
                      // there instead of becoming a second line - the gutter
                      // still reads "1" while four rows of grey text sit next
                      // to it, which looks like a broken editor.
                      placeholder={t(
                        cssScope === "site"
                          ? "editor.cssPlaceholder"
                          : "editor.globalCssPlaceholder",
                      )}
                    />
                  </Suspense>

                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card p-1">
                    <Button
                      onClick={() =>
                        setCssDrafts((drafts) =>
                          updateCssDraft(
                            drafts,
                            cssScope,
                            formatCSS(currentCss.draft),
                          ),
                        )
                      }
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={cssBusy}
                    >
                      {t("editor.format")}
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(currentCss.draft);
                          setCssCopyStates((states) => ({
                            ...states,
                            [cssScope]: "copied",
                          }));
                        } catch (error) {
                          console.error("Error copying CSS:", error);
                          setCssCopyStates((states) => ({
                            ...states,
                            [cssScope]: "error",
                          }));
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t("common.copy")}
                    </Button>
                    <Button
                      onClick={handlePopOutEditor}
                      variant="link"
                      size="sm"
                      className="ms-auto h-7 px-1 text-xs"
                      disabled={cssScope === "site" && !hostname}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("options.popOutCss")}
                    </Button>
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {t("editor.cssLayering")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      onClick={handleSaveCSS}
                      disabled={
                        cssBusy ||
                        !hasChanges ||
                        !globalEnabled ||
                        (cssScope === "site" && !hostname)
                      }
                      variant="olive"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {cssBusy ? t("editor.saving") : t("editor.saveCss")}
                    </Button>
                    <Button
                      onClick={handleRemoveCSS}
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={
                        cssBusy ||
                        !currentCss.saved ||
                        !globalEnabled ||
                        (cssScope === "site" && !hostname)
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("editor.removeCss")}
                    </Button>
                    <Button
                      onClick={() => {
                        setCssDrafts((drafts) =>
                          discardCssDraft(drafts, cssScope),
                        );
                        setCssSaveStates((states) => ({
                          ...states,
                          [cssScope]: "idle",
                        }));
                      }}
                      disabled={!hasChanges}
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("common.reset")}
                    </Button>
                    {cssScope === "site" && sourceHost === hostname && (
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
                  <p
                    role="status"
                    className={`text-xs ${cssSaveStates[cssScope] === "error" || cssCopyStates[cssScope] === "error" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {cssSaveStates[cssScope] === "error"
                      ? t("editor.saveError")
                      : cssSaveStates[cssScope] === "saved" && !hasChanges
                        ? t("editor.saved")
                        : cssCopyStates[cssScope] === "error"
                          ? t("editor.copyError")
                          : cssCopyStates[cssScope] === "copied"
                            ? t("editor.copied")
                            : ""}
                  </p>
                </section>
              )}

              {activeTab === "settings" && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-bold tracking-tight">
                      {t("tabs.settings")}
                    </h1>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("about")}
                    >
                      <Info className="h-4 w-4" />
                      {t("tabs.about")}
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label
                        htmlFor="styleshift-enabled"
                        className="text-sm font-semibold"
                      >
                        {t("settings.enableStyleShift")}
                      </Label>
                      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        {globalEnabled
                          ? t("popup.statusEnabled")
                          : t("popup.statusDisabled")}
                      </p>
                    </div>
                    <Switch
                      id="styleshift-enabled"
                      checked={globalEnabled}
                      onCheckedChange={handleGlobalToggle}
                    />
                  </div>

                  <Separator />

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
                    <SegmentedControl
                      options={THEME_OPTIONS.map((option) => ({
                        value: option.value,
                        label: t(option.labelKey),
                        icon: option.icon,
                      }))}
                      value={theme}
                      onChange={setTheme}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-semibold">
                      {t("settings.language")}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("settings.languageHelp")}
                    </p>
                    <SegmentedControl
                      options={LOCALES.map((option) => ({
                        value: option.code,
                        label: option.nativeName,
                      }))}
                      value={locale}
                      onChange={setLocale}
                    />
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
                      onClick={() =>
                        chrome.tabs.create({
                          url: chrome.runtime.getURL("options.html?view=sites"),
                        })
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("settings.manageSites")}
                    </Button>
                  </div>
                </section>
              )}

              {activeTab === "about" && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-bold tracking-tight">
                      {t("tabs.about")}
                    </h1>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("settings")}
                    >
                      <Settings className="h-4 w-4" />
                      {t("tabs.settings")}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <BrandIcon className="h-10 w-10" />
                      <h2 className="text-base font-bold">StyleShift</h2>
                    </div>
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
