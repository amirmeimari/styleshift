import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Globe2,
  Info,
  Library,
  LockKeyhole,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { CustomFontManager } from "@/components/custom-font-manager";
import { BrandIcon } from "@/components/brand-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatCSS } from "@/css-editor/format-css";
import {
  backupFilename,
  isHostSettingsKey,
  isValidHostSettingsKey,
  parseBackup,
  serializeBackup,
  type StyleShiftBackup,
} from "@/shared/backup";
import { applyBackup, collectBackup } from "@/shared/backup-storage";
import { BUILTIN_FONTS } from "@/shared/builtin-fonts";
import { readCustomFonts } from "@/shared/custom-fonts";
import { LOCALES, type LocaleCode } from "@/shared/i18n/locales";
import { useI18n } from "@/shared/i18n/use-i18n";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TYPOGRAPHY,
  POPULAR_SITE_PRESETS,
  TYPOGRAPHY_RANGES,
  customFontFaces,
  type StyleShiftSettings,
  type TypographySettings,
} from "@/shared/style-core";
import {
  clearHostSettings,
  readAutoEnableAllSites,
  readGlobalCSS,
  readGlobalEnabled,
  readHostSettings,
  readTypography,
  resolveHostSettings,
  updateAutoEnableAllSites,
  updateGlobalCSS,
  updateGlobalEnabled,
  updateHostSettings,
  updateTypography,
} from "@/shared/storage";
import { useTheme } from "@/shared/theme-provider";
import type { ThemePref } from "@/shared/theme";
import {
  filterSites,
  normalizeSiteInput,
  optionsSearchForView,
  optionsViewFromSearch,
  type OptionsView,
} from "./options-workflow";

const CssEditor = lazy(() =>
  import("@/css-editor/css-editor").then((module) => ({
    default: module.CssEditor,
  })),
);

type SiteRow = { host: string; settings: StyleShiftSettings };

const NAV_ITEMS = [
  { id: "sites", icon: Globe2, label: "options.navSites" },
  { id: "global-css", icon: Braces, label: "options.navGlobalCss" },
  { id: "library", icon: Library, label: "options.navLibrary" },
  { id: "settings", icon: Settings, label: "tabs.settings" },
  { id: "about", icon: Info, label: "tabs.about" },
] as const;

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "settings.themeLight" },
  { value: "dark", label: "settings.themeDark" },
  { value: "system", label: "settings.themeSystem" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadSiteRows(): Promise<SiteRow[]> {
  const all = (await chrome.storage.local.get(null)) as Record<string, unknown>;
  return Object.entries(all)
    .filter(
      ([key, value]) =>
        isHostSettingsKey(key) &&
        isValidHostSettingsKey(key) &&
        value &&
        typeof value === "object",
    )
    .map(([host, value]) => ({
      host,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(value as Partial<StyleShiftSettings>),
      },
    }))
    .sort((a, b) => a.host.localeCompare(b.host));
}

function EditorFallback({ height = 280 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg border border-border bg-card"
      style={{ minHeight: height }}
      aria-hidden="true"
    />
  );
}

export function OptionsApp() {
  const { t, dir, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [activeView, setActiveView] = useState<OptionsView>(() =>
    optionsViewFromSearch(window.location.search),
  );
  const [typography, setTypography] =
    useState<TypographySettings>(DEFAULT_TYPOGRAPHY);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [autoEnableAllSites, setAutoEnableAllSites] = useState(false);
  const [shortcut, setShortcut] = useState("Alt + Shift + S");
  const [appVersion, setAppVersion] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [settingsError, setSettingsError] = useState(false);

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [newSite, setNewSite] = useState("");
  const [siteActionStatus, setSiteActionStatus] = useState<string | null>(null);
  const [siteActionError, setSiteActionError] = useState<string | null>(null);
  const [presetStates, setPresetStates] = useState<Record<string, boolean>>({});

  const [librarySearch, setLibrarySearch] = useState("");
  const [customFontCss, setCustomFontCss] = useState("");

  const [exportIncludeFonts, setExportIncludeFonts] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    backup: StyleShiftBackup;
    warnings: string[];
  } | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [editingHost, setEditingHost] = useState<string | null>(null);
  const [editingSettings, setEditingSettings] =
    useState<StyleShiftSettings | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editingSaved, setEditingSaved] = useState<string | null>(null);
  const [editingError, setEditingError] = useState(false);
  const [editingSaving, setEditingSaving] = useState(false);
  const editorGeneration = useRef(0);
  const siteEditorRef = useRef<HTMLElement>(null);
  const siteEditorTriggerRef = useRef<HTMLButtonElement>(null);

  const [globalCSS, setGlobalCSS] = useState("");
  const [globalCSSDraft, setGlobalCSSDraft] = useState("");
  const [globalCssSaved, setGlobalCssSaved] = useState<string | null>(null);
  const [globalCssError, setGlobalCssError] = useState(false);
  const [globalCssSaving, setGlobalCssSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const filteredSites = useMemo(
    () => filterSites(sites, siteSearch),
    [siteSearch, sites],
  );
  const filteredBuiltinFonts = useMemo(() => {
    const query = librarySearch.trim().toLocaleLowerCase();
    return BUILTIN_FONTS.filter((font) =>
      font.name.toLocaleLowerCase().includes(query),
    );
  }, [librarySearch]);

  async function reloadCustomFonts() {
    const fonts = await readCustomFonts();
    setCustomFontCss(customFontFaces(fonts));
  }

  async function refreshSitesAndPresets() {
    const [rows, presetEntries] = await Promise.all([
      loadSiteRows(),
      Promise.all(
        POPULAR_SITE_PRESETS.map(
          async (preset) =>
            [
              preset.host,
              (await readHostSettings(preset.host)).fontEnabled,
            ] as const,
        ),
      ),
    ]);
    setSites(rows);
    setPresetStates(Object.fromEntries(presetEntries));
  }

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        globalCSSDraft === globalCSS &&
        (!editingSettings || editingDraft === editingSettings.customCSS)
      ) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [globalCSSDraft, globalCSS, editingDraft, editingSettings]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [
        storedTypography,
        storedGlobalCSS,
        storedGlobalEnabled,
        storedAutoEnable,
      ] = await Promise.all([
        readTypography(),
        readGlobalCSS(),
        readGlobalEnabled(),
        readAutoEnableAllSites(),
        refreshSitesAndPresets(),
        reloadCustomFonts(),
      ]);
      if (!mounted) return;
      setTypography(storedTypography);
      setGlobalCSS(storedGlobalCSS);
      setGlobalCSSDraft(storedGlobalCSS);
      setGlobalEnabled(storedGlobalEnabled);
      setAutoEnableAllSites(storedAutoEnable);

      try {
        const command = (await chrome.commands?.getAll?.())?.find(
          (item) => item.name === "toggle-font",
        );
        if (command?.shortcut) setShortcut(command.shortcut);
      } catch {
        // Keep the manifest default if command inspection is unavailable.
      }
      try {
        setAppVersion(chrome.runtime.getManifest().version);
      } catch {
        setAppVersion("");
      }
    }
    load()
      .then(() => {
        if (mounted) setLoaded(true);
      })
      .catch((error) => {
        console.error("Error loading options:", error);
        if (mounted) setLoadError(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onPopState = () =>
      setActiveView(optionsViewFromSearch(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const editor = siteEditorRef.current;
    if (
      editor &&
      editor.getBoundingClientRect().top + 96 > window.innerHeight
    ) {
      editor.scrollIntoView({ block: "nearest" });
    }
  }, [editingHost, loaded]);

  async function handleLocaleChange(next: LocaleCode) {
    // Transient messages are already-rendered strings. Clear them before the
    // locale changes instead of leaving a stale sentence from the old locale
    // inside an otherwise translated view.
    setSiteActionStatus(null);
    setSiteActionError(null);
    setEditingSaved(null);
    setGlobalCssSaved(null);
    setCopyStatus(null);
    setExportError(null);
    setImportError(null);
    setImportSuccess(null);
    await setLocale(next);
  }

  useEffect(() => {
    const host = new URLSearchParams(window.location.search).get("host");
    if (host && isValidHostSettingsKey(host)) {
      openEditor(host).catch((error) =>
        console.error("Error opening site editor:", error),
      );
    }
    // Only consume the direct route once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(view: OptionsView) {
    if (view === activeView) return;
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${optionsSearchForView(view)}`,
    );
    setActiveView(view);
  }

  async function handleGlobalEnabledChange(enabled: boolean) {
    setSettingsError(false);
    const previous = globalEnabled;
    setGlobalEnabled(enabled);
    try {
      await updateGlobalEnabled(enabled);
    } catch {
      setGlobalEnabled(previous);
      setSettingsError(true);
    }
  }

  async function handleAutoEnableChange(enabled: boolean) {
    setSettingsError(false);
    const previous = autoEnableAllSites;
    setAutoEnableAllSites(enabled);
    try {
      await updateAutoEnableAllSites(enabled);
      await refreshSitesAndPresets();
    } catch {
      setAutoEnableAllSites(previous);
      setSettingsError(true);
    }
  }

  async function handleMinFontSizeChange(value: number) {
    setSettingsError(false);
    try {
      const next = await updateTypography({ minFontSize: value });
      setTypography(next);
    } catch {
      setSettingsError(true);
    }
  }

  async function handleTurnOffMinimum() {
    setSettingsError(false);
    try {
      const next = await updateTypography({ minFontSize: null });
      setTypography(next);
    } catch {
      setSettingsError(true);
    }
  }

  async function patchSite(host: string, patch: Partial<StyleShiftSettings>) {
    setSiteActionError(null);
    setSiteActionStatus(null);
    try {
      const resolved = await resolveHostSettings(host);
      const base =
        resolved.sourceHost === host
          ? resolved.settings
          : {
              ...DEFAULT_SETTINGS,
              fontEnabled: resolved.settings.fontEnabled,
            };
      await updateHostSettings(host, { ...base, ...patch });
      await refreshSitesAndPresets();
      setSiteActionStatus(t("options.siteUpdated", { host }));
    } catch (error) {
      console.error("Error updating site:", error);
      setSiteActionError(t("options.siteUpdateError", { host }));
    }
  }

  async function handleAddSite(event: FormEvent) {
    event.preventDefault();
    const host = normalizeSiteInput(newSite);
    if (!host || !isValidHostSettingsKey(host)) {
      setSiteActionError(t("options.invalidSite"));
      setSiteActionStatus(null);
      return;
    }
    try {
      const resolved = await resolveHostSettings(host);
      const base =
        resolved.sourceHost === host
          ? resolved.settings
          : {
              ...DEFAULT_SETTINGS,
              fontEnabled: resolved.settings.fontEnabled,
            };
      await updateHostSettings(host, { ...base, fontEnabled: true });
      setNewSite("");
      setSiteSearch("");
      await refreshSitesAndPresets();
      setSiteActionError(null);
      setSiteActionStatus(t("options.siteAdded", { host }));
    } catch (error) {
      console.error("Error adding site:", error);
      setSiteActionError(t("options.siteUpdateError", { host }));
    }
  }

  async function handleDeleteSite(host: string) {
    if (!window.confirm(t("options.deleteSiteConfirm", { host }))) return;
    setSiteActionError(null);
    try {
      await clearHostSettings(host);
      await refreshSitesAndPresets();
      if (editingHost === host) closeEditor(true);
      setSiteActionStatus(t("options.siteRemoved", { host }));
    } catch {
      setSiteActionError(t("options.siteUpdateError", { host }));
    }
  }

  async function handleClearAllSites() {
    if (sites.length === 0 || !window.confirm(t("options.clearAllConfirm"))) {
      return;
    }
    setSiteActionError(null);
    try {
      await chrome.storage.local.remove(sites.map((site) => site.host));
      await refreshSitesAndPresets();
      closeEditor(true);
    } catch {
      setSiteActionError(t("settings.saveError"));
    }
  }

  async function openEditor(host: string, discardConfirmed = false) {
    if (
      !discardConfirmed &&
      editingHost &&
      editingDraft !== editingSettings?.customCSS &&
      !window.confirm(t("editor.discardSiteDraft"))
    ) {
      return;
    }
    const generation = ++editorGeneration.current;
    try {
      const resolved = await resolveHostSettings(host);
      if (generation !== editorGeneration.current) return;
      setEditingHost(host);
      setEditingSettings(
        resolved.sourceHost === host
          ? resolved.settings
          : {
              ...DEFAULT_SETTINGS,
              fontEnabled: resolved.settings.fontEnabled,
              customCSS: resolved.settings.customCSS,
              cssEnabled: resolved.settings.cssEnabled,
            },
      );
      setEditingDraft(resolved.settings.customCSS);
      setEditingSaved(null);
      setEditingError(false);
      setActiveView("sites");
    } catch {
      setSiteActionError(t("options.siteUpdateError", { host }));
    }
  }

  function closeEditor(force = false): boolean {
    if (
      !force &&
      editingDraft !== editingSettings?.customCSS &&
      !window.confirm(t("editor.discardSiteDraft"))
    ) {
      return false;
    }
    ++editorGeneration.current;
    setEditingHost(null);
    setEditingSettings(null);
    setEditingDraft("");
    setEditingSaved(null);
    return true;
  }

  async function handleSaveEditingCSS() {
    if (!editingHost || !editingSettings) return;
    const generation = editorGeneration.current;
    setEditingSaving(true);
    setEditingError(false);
    try {
      const next = await writeEditingCSS(editingHost, editingDraft);
      if (generation === editorGeneration.current) {
        setEditingSettings(next);
        setEditingSaved(t("options.cssEditorSavedFor", { host: editingHost }));
      }
      await refreshSitesAndPresets();
    } catch (error) {
      console.error("Error saving site CSS:", error);
      if (generation === editorGeneration.current) setEditingError(true);
    } finally {
      setEditingSaving(false);
    }
  }

  async function writeEditingCSS(host: string, value: string) {
    // The editor can stay open while site switches, another extension page,
    // or an import changes the record. Only CSS belongs to this save.
    const resolved = await resolveHostSettings(host);
    const base =
      resolved.sourceHost === host
        ? resolved.settings
        : {
            ...DEFAULT_SETTINGS,
            fontEnabled: resolved.settings.fontEnabled,
            cssEnabled: resolved.settings.cssEnabled,
          };
    const next = { ...base, customCSS: value };
    await updateHostSettings(host, next);
    return next;
  }

  async function handleSaveGlobalCSS() {
    setGlobalCssSaving(true);
    setGlobalCssError(false);
    try {
      await updateGlobalCSS(globalCSSDraft);
      setGlobalCSS(globalCSSDraft);
      setGlobalCssSaved(t("options.globalCssSaved"));
    } catch (error) {
      console.error("Error saving global CSS:", error);
      setGlobalCssError(true);
    } finally {
      setGlobalCssSaving(false);
    }
  }

  async function copyCSS(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(t("editor.copied"));
    } catch (error) {
      console.error("Error copying CSS:", error);
      setCopyStatus(t("editor.copyError"));
    }
  }

  async function removeCSS(scope: "site" | "global") {
    if (scope === "site" && (!editingHost || !editingSettings)) return;
    if (!window.confirm(t("editor.removeCssConfirm"))) return;
    const generation = editorGeneration.current;
    try {
      if (scope === "global") {
        setGlobalCssSaving(true);
        await updateGlobalCSS("");
        setGlobalCSS("");
        setGlobalCSSDraft("");
        setGlobalCssSaved(t("options.globalCssSaved"));
        setGlobalCssError(false);
      } else if (editingHost && editingSettings) {
        setEditingSaving(true);
        const next = await writeEditingCSS(editingHost, "");
        if (generation === editorGeneration.current) {
          setEditingSettings(next);
          setEditingDraft("");
          setEditingSaved(
            t("options.cssEditorSavedFor", { host: editingHost }),
          );
          setEditingError(false);
        }
        await refreshSitesAndPresets();
      }
    } catch (error) {
      console.error("Error removing CSS:", error);
      if (scope === "global") setGlobalCssError(true);
      else if (generation === editorGeneration.current) setEditingError(true);
    } finally {
      setGlobalCssSaving(false);
      setEditingSaving(false);
    }
  }

  async function handleExport() {
    setExportError(null);
    try {
      const backup = await collectBackup(exportIncludeFonts);
      const json = serializeBackup(backup);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFilename(new Date());
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setExportStatus(formatBytes(blob.size));
    } catch {
      setExportError(t("options.exportError"));
    }
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportSuccess(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportPreview(null);
      setImportError(t("options.importReadError"));
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setImportPreview(null);
      setImportError(
        t(
          result.error === "invalid-json"
            ? "options.importErrorInvalidJson"
            : result.error === "unsupported-version"
              ? "options.importErrorUnsupportedVersion"
              : "options.importErrorNotABackup",
        ),
      );
      return;
    }
    setImportError(null);
    setImportPreview({ backup: result.backup, warnings: result.warnings });
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    const hasDrafts =
      globalCSSDraft !== globalCSS ||
      (editingSettings && editingDraft !== editingSettings.customCSS);
    if (hasDrafts && !window.confirm(t("options.importDiscardDrafts"))) return;
    try {
      const report = await applyBackup(importPreview.backup, importMode);
      setImportPreview(null);
      setImportSuccess(
        t("options.importSuccess", { sites: report.sitesWritten }),
      );
      const [nextTypography, nextGlobalCSS, nextEnabled, nextAutoEnable] =
        await Promise.all([
          readTypography(),
          readGlobalCSS(),
          readGlobalEnabled(),
          readAutoEnableAllSites(),
          refreshSitesAndPresets(),
          reloadCustomFonts(),
        ]);
      setTypography(nextTypography);
      setGlobalCSS(nextGlobalCSS);
      setGlobalCSSDraft(nextGlobalCSS);
      setGlobalEnabled(nextEnabled);
      setAutoEnableAllSites(nextAutoEnable);
      if (editingHost) await openEditor(editingHost, true);
    } catch (error) {
      console.error("Error importing backup:", error);
      setImportError(t("options.importErrorApplyFailed"));
    }
  }

  if (!loaded)
    return (
      <main dir={dir} className="p-6 text-sm">
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

  const siteEditor = editingHost && editingSettings && (
    <section
      id="site-css-editor"
      ref={siteEditorRef}
      aria-labelledby="site-css-editor-heading"
      className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 md:col-span-full"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="site-css-editor-heading" className="text-base font-bold">
            {t("options.siteEditor")}
          </h2>
          <bdi
            dir="ltr"
            className="block truncate text-xs text-muted-foreground"
          >
            {editingHost}
          </bdi>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteSite(editingHost)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("options.resetToInherited")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (closeEditor()) siteEditorTriggerRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.close")}</span>
          </Button>
        </div>
      </div>
      <Suspense fallback={<EditorFallback height={240} />}>
        <CssEditor
          value={editingDraft}
          ariaLabel={`${t("editor.thisSite")}: ${editingHost}`}
          onChange={setEditingDraft}
          readOnly={editingSaving}
          className="min-h-[240px]"
        />
      </Suspense>
      <EditorActions
        value={editingDraft}
        savedValue={editingSettings.customCSS}
        saving={editingSaving}
        savedMessage={editingSaved}
        error={editingError}
        copyStatus={copyStatus}
        onFormat={() => {
          setEditingDraft(formatCSS(editingDraft));
          setEditingSaved(null);
        }}
        onCopy={() => copyCSS(editingDraft)}
        onDiscard={() => {
          setEditingDraft(editingSettings.customCSS);
          setEditingError(false);
        }}
        onRemove={() => removeCSS("site")}
        onSave={handleSaveEditingCSS}
      />
    </section>
  );

  return (
    <main dir={dir} className="min-h-screen bg-background text-foreground">
      {customFontCss && <style>{customFontCss}</style>}
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-e">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center gap-2.5 px-5">
              <BrandIcon className="h-9 w-9" />
              <span className="text-xl font-bold tracking-tight">
                StyleShift
              </span>
            </div>
            <nav
              aria-label={t("options.navigation")}
              className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const selected = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    onClick={() => navigate(item.id)}
                    className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full ${
                      selected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {t(item.label)}
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto hidden items-center gap-2 px-5 py-5 text-xs text-muted-foreground lg:flex">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {t("options.offlineByDesign")}
            </div>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-5xl">
            {activeView === "sites" && (
              <section aria-labelledby="sites-heading" className="space-y-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1
                      id="sites-heading"
                      className="text-2xl font-bold tracking-tight"
                    >
                      {t("options.yourSites")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("options.yourSitesHelp")}
                    </p>
                  </div>
                  <form
                    onSubmit={handleAddSite}
                    className="flex w-full gap-2 sm:w-auto"
                  >
                    <Input
                      value={newSite}
                      onChange={(event) => setNewSite(event.target.value)}
                      placeholder={t("options.addSitePlaceholder")}
                      aria-label={t("options.addSitePlaceholder")}
                      className="min-w-0 sm:w-52"
                    />
                    <Button type="submit" disabled={!newSite.trim()}>
                      {t("options.addSite")}
                    </Button>
                  </form>
                </div>

                <div className="rounded-lg border border-primary/15 bg-accent px-4 py-3 text-sm text-accent-foreground">
                  <Info className="me-2 inline h-4 w-4" aria-hidden="true" />
                  {t("options.sharedPairing")}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    value={siteSearch}
                    onChange={(event) => setSiteSearch(event.target.value)}
                    placeholder={t("options.searchSites")}
                    aria-label={t("options.searchSites")}
                    className="ps-9"
                  />
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="hidden grid-cols-[minmax(180px,1fr)_100px_100px_150px_44px] gap-3 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground md:grid">
                    <span>{t("options.website")}</span>
                    <span>{t("tabs.fonts")}</span>
                    <span>{t("tabs.css")}</span>
                    <span>{t("options.subdomains")}</span>
                    <span className="sr-only">{t("options.actions")}</span>
                  </div>
                  {filteredSites.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {sites.length === 0
                        ? t("options.sitesEmpty")
                        : t("options.noSiteMatches")}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredSites.map(({ host, settings }) => (
                        <li
                          key={host}
                          className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(180px,1fr)_100px_100px_150px_44px] md:items-center"
                        >
                          <div className="min-w-0">
                            <bdi
                              dir="ltr"
                              className="block truncate text-sm font-semibold"
                            >
                              {host}
                            </bdi>
                            <span className="text-[11px] text-muted-foreground">
                              {settings.customCSS
                                ? t("options.cssBytes", {
                                    size: formatBytes(
                                      new Blob([settings.customCSS]).size,
                                    ),
                                  })
                                : t("options.ownSettings")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 md:block">
                            <span className="text-xs text-muted-foreground md:sr-only">
                              {t("tabs.fonts")}
                            </span>
                            <Switch
                              checked={settings.fontEnabled}
                              onCheckedChange={(checked) =>
                                patchSite(host, { fontEnabled: checked })
                              }
                              aria-label={`${t("tabs.fonts")}: ${host}`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 md:block">
                            <span className="text-xs text-muted-foreground md:sr-only">
                              {t("tabs.css")}
                            </span>
                            <Switch
                              checked={settings.cssEnabled}
                              onCheckedChange={(checked) =>
                                patchSite(host, { cssEnabled: checked })
                              }
                              aria-label={`${t("tabs.css")}: ${host}`}
                            />
                          </div>
                          <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground md:justify-start">
                            <span>{t("options.subdomains")}</span>
                            <input
                              type="checkbox"
                              checked={settings.includeSubdomains}
                              onChange={(event) =>
                                patchSite(host, {
                                  includeSubdomains: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-primary"
                            />
                          </label>
                          <div className="flex justify-end gap-1 md:justify-start">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              ref={
                                editingHost === host
                                  ? siteEditorTriggerRef
                                  : undefined
                              }
                              onClick={() => {
                                if (editingHost === host) closeEditor();
                                else void openEditor(host);
                              }}
                              aria-expanded={editingHost === host}
                              aria-controls={
                                editingHost === host
                                  ? "site-css-editor"
                                  : undefined
                              }
                              aria-label={t("options.editSite", { host })}
                              title={t("options.editSite", { host })}
                            >
                              {editingHost === host ? (
                                <ChevronDown aria-hidden="true" />
                              ) : (
                                <ChevronRight
                                  className="rtl:rotate-180"
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="md:hidden"
                              onClick={() => handleDeleteSite(host)}
                              aria-label={t("options.deleteSite")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {editingHost === host && siteEditor}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div aria-live="polite" className="min-h-5 text-xs">
                  {siteActionError ? (
                    <span role="alert" className="text-destructive">
                      {siteActionError}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {siteActionStatus}
                    </span>
                  )}
                </div>

                {siteEditor &&
                  !filteredSites.some(({ host }) => host === editingHost) &&
                  siteEditor}

                <section
                  aria-labelledby="quick-enable-heading"
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2
                        id="quick-enable-heading"
                        className="text-xl font-bold tracking-tight"
                      >
                        {t("options.quickEnable")}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("options.quickEnableHelp")}
                      </p>
                    </div>
                    {sites.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAllSites}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("options.clearAllSites")}
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {POPULAR_SITE_PRESETS.map((preset) => (
                      <div
                        key={preset.host}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <img
                          src={`/icons/presets/${preset.svgIcon}.svg`}
                          alt=""
                          className={`h-5 w-5 object-contain ${
                            preset.monochrome ? "dark:invert" : ""
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {preset.label}
                          </span>
                          <bdi
                            dir="ltr"
                            className="block truncate text-[10px] text-muted-foreground"
                          >
                            {preset.host}
                          </bdi>
                        </div>
                        <Switch
                          checked={presetStates[preset.host] ?? false}
                          onCheckedChange={(checked) =>
                            patchSite(preset.host, { fontEnabled: checked })
                          }
                          aria-label={`${preset.label}: ${t("tabs.fonts")}`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </section>
            )}

            {activeView === "global-css" && (
              <section
                aria-labelledby="global-css-heading"
                className="space-y-5"
              >
                <div>
                  <h1
                    id="global-css-heading"
                    className="text-2xl font-bold tracking-tight"
                  >
                    {t("options.globalCssTitle")}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {t("options.globalCssHelp")}
                  </p>
                </div>
                <Suspense fallback={<EditorFallback />}>
                  <CssEditor
                    value={globalCSSDraft}
                    ariaLabel={t("options.globalCssTitle")}
                    onChange={setGlobalCSSDraft}
                    readOnly={globalCssSaving}
                    className="min-h-[240px]"
                  />
                </Suspense>
                <EditorActions
                  value={globalCSSDraft}
                  savedValue={globalCSS}
                  saving={globalCssSaving}
                  savedMessage={globalCssSaved}
                  error={globalCssError}
                  copyStatus={copyStatus}
                  onFormat={() => {
                    setGlobalCSSDraft(formatCSS(globalCSSDraft));
                    setGlobalCssSaved(null);
                  }}
                  onCopy={() => copyCSS(globalCSSDraft)}
                  onDiscard={() => {
                    setGlobalCSSDraft(globalCSS);
                    setGlobalCssError(false);
                  }}
                  onRemove={() => removeCSS("global")}
                  onSave={handleSaveGlobalCSS}
                />
              </section>
            )}

            {activeView === "library" && (
              <section aria-labelledby="library-heading" className="space-y-6">
                <div>
                  <h1
                    id="library-heading"
                    className="text-2xl font-bold tracking-tight"
                  >
                    {t("fonts.libraryTitle")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredBuiltinFonts.map((font) => (
                      <div
                        key={font.name}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div>
                          <div
                            className="text-sm font-semibold"
                            style={{
                              fontFamily: `'${font.name}', sans-serif`,
                            }}
                          >
                            {font.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {font.category === "mono"
                              ? t("fonts.codeFont")
                              : t("fonts.bodyFont")}
                          </div>
                        </div>
                        <span
                          className="text-xl"
                          aria-hidden="true"
                          style={{ fontFamily: `'${font.name}', sans-serif` }}
                        >
                          Aa
                        </span>
                      </div>
                    ))}
                  </div>
                  {filteredBuiltinFonts.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t("fonts.noBundledMatches")}
                    </p>
                  )}
                </div>
                <CustomFontManager
                  searchQuery={librarySearch}
                  onFontsChanged={reloadCustomFonts}
                />
              </section>
            )}

            {activeView === "settings" && (
              <section aria-labelledby="settings-heading" className="space-y-6">
                {settingsError && (
                  <p role="alert" className="text-xs text-destructive">
                    {t("settings.saveError")}
                  </p>
                )}
                <div>
                  <h1
                    id="settings-heading"
                    className="text-2xl font-bold tracking-tight"
                  >
                    {t("tabs.settings")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("options.preferencesHelp")}
                  </p>
                </div>

                <SettingsGroup title={t("options.behaviorTitle")}>
                  <SettingRow
                    label={t("settings.enableStyleShift")}
                    help={t("options.globalEnableHelp")}
                    control={
                      <Switch
                        checked={globalEnabled}
                        onCheckedChange={handleGlobalEnabledChange}
                        aria-label={t("settings.enableStyleShift")}
                      />
                    }
                  />
                  <SettingRow
                    label={t("options.newSites")}
                    help={t("options.newSitesHelp")}
                    control={
                      <Switch
                        checked={autoEnableAllSites}
                        onCheckedChange={handleAutoEnableChange}
                        aria-label={t("options.newSites")}
                      />
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title={t("options.appearanceTitle")}>
                  <div className="space-y-2 px-4 py-4">
                    <Label>{t("settings.theme")}</Label>
                    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
                      {THEME_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={theme === option.value}
                          onClick={() => setTheme(option.value)}
                          className={`border-e border-border px-3 py-2 text-sm last:border-e-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                            theme === option.value
                              ? "bg-accent font-semibold text-accent-foreground"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {t(option.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border px-4 py-4">
                    <Label htmlFor="options-language">
                      {t("settings.language")}
                    </Label>
                    <select
                      id="options-language"
                      value={locale}
                      onChange={(event) =>
                        handleLocaleChange(event.target.value as LocaleCode)
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {LOCALES.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.nativeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </SettingsGroup>

                <SettingsGroup title={t("options.readabilityTitle")}>
                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label htmlFor="min-font-size">
                          {t("options.minFontSizeTitle")}
                        </Label>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {t("options.minFontSizeHelp")}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {typography.minFontSize ?? t("popup.typographyDefault")}
                        {typography.minFontSize !== null ? "px" : ""}
                      </span>
                    </div>
                    <input
                      id="min-font-size"
                      type="range"
                      min={TYPOGRAPHY_RANGES.minFontSize.min}
                      max={TYPOGRAPHY_RANGES.minFontSize.max}
                      step={1}
                      value={
                        typography.minFontSize ??
                        TYPOGRAPHY_RANGES.minFontSize.min
                      }
                      onChange={(event) =>
                        handleMinFontSizeChange(Number(event.target.value))
                      }
                      className="w-full accent-primary"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={typography.minFontSize === null}
                      onClick={handleTurnOffMinimum}
                    >
                      {t("options.turnOff")}
                    </Button>
                  </div>
                </SettingsGroup>

                <SettingsGroup title={t("options.keyboardShortcut")}>
                  <SettingRow
                    label={t("options.toggleSiteFonts")}
                    help={t("options.shortcutHelp")}
                    control={
                      <kbd
                        dir="ltr"
                        className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs"
                      >
                        {shortcut}
                      </kbd>
                    }
                  />
                </SettingsGroup>

                <SettingsGroup title={t("options.backupTitle")}>
                  <div className="space-y-4 px-4 py-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("options.backupHelp")}
                    </p>
                    <Label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={exportIncludeFonts}
                        onChange={(event) =>
                          setExportIncludeFonts(event.target.checked)
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      {t("options.exportIncludeFonts")}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleExport}
                      >
                        <Download className="h-4 w-4" />
                        {t("options.exportSettings")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleFileChosen}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        {t("options.chooseFile")}
                      </Button>
                    </div>
                    {exportStatus && (
                      <p className="text-xs text-muted-foreground">
                        {t("options.exportSizeEstimate", {
                          size: exportStatus,
                        })}
                      </p>
                    )}
                    {exportError && (
                      <p role="alert" className="text-xs text-destructive">
                        {exportError}
                      </p>
                    )}
                    {importError && (
                      <p role="alert" className="text-xs text-destructive">
                        {importError}
                      </p>
                    )}
                    {importSuccess && (
                      <p
                        role="status"
                        className="text-xs text-[var(--fabric-green-thread)]"
                      >
                        {importSuccess}
                      </p>
                    )}

                    {importPreview && (
                      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                        <p className="text-sm font-semibold">
                          {t("options.importPreviewSummary", {
                            sites: Object.keys(importPreview.backup.sites)
                              .length,
                            fonts: importPreview.backup.fonts?.length ?? 0,
                          })}
                        </p>
                        {importPreview.warnings.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-destructive">
                              {t("options.importWarnings")}
                            </p>
                            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                              {importPreview.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <Label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="import-mode"
                              checked={importMode === "merge"}
                              onChange={() => setImportMode("merge")}
                            />
                            {t("options.importModeMerge")}
                          </Label>
                          <Label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="import-mode"
                              checked={importMode === "replace"}
                              onChange={() => setImportMode("replace")}
                            />
                            {t("options.importModeReplace")}
                          </Label>
                        </div>
                        {importMode === "replace" && (
                          <p className="text-xs text-destructive">
                            {t("options.importModeReplaceWarning")}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleConfirmImport}
                            disabled={editingSaving || globalCssSaving}
                          >
                            {t("options.importConfirm")}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setImportPreview(null);
                              setImportError(null);
                            }}
                          >
                            {t("common.close")}
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("options.localBackup")}
                    </p>
                  </div>
                </SettingsGroup>
              </section>
            )}

            {activeView === "about" && (
              <section aria-labelledby="about-heading" className="space-y-6">
                <div>
                  <h1
                    id="about-heading"
                    className="text-2xl font-bold tracking-tight"
                  >
                    {t("tabs.about")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("options.aboutSubtitle")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <BrandIcon className="h-12 w-12" />
                    <div>
                      <h2 className="text-xl font-bold">StyleShift</h2>
                      {appVersion && (
                        <p className="text-xs text-muted-foreground">
                          v{appVersion}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {t("about.description")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <LockKeyhole className="h-5 w-5 text-primary" />
                    <h2 className="mt-3 text-sm font-bold">
                      {t("options.privacyTitle")}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t("options.privacyHelp")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <Library className="h-5 w-5 text-primary" />
                    <h2 className="mt-3 text-sm font-bold">
                      {t("options.localAssetsTitle")}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t("options.localAssetsHelp")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm">
                  <span className="text-muted-foreground">
                    {t("about.madeBy")}
                  </span>
                  <span className="font-semibold">Amir Meimari</span>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  help,
  control,
}: {
  label: string;
  help: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {help}
        </p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function EditorActions({
  value,
  savedValue,
  saving,
  savedMessage,
  error,
  copyStatus,
  onFormat,
  onCopy,
  onDiscard,
  onRemove,
  onSave,
}: {
  value: string;
  savedValue: string;
  saving: boolean;
  savedMessage: string | null;
  error: boolean;
  copyStatus: string | null;
  onFormat: () => void;
  onCopy: () => void;
  onDiscard: () => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const dirty = value !== savedValue;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onFormat}
          disabled={saving}
        >
          {t("editor.format")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
          {t("common.copy")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={saving || !dirty}
          onClick={onDiscard}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("common.reset")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving || !savedValue}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("editor.removeCss")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || !dirty}
          onClick={onSave}
        >
          <Save className="h-3.5 w-3.5" />
          {t("common.save")}
        </Button>
      </div>
      <p
        role="status"
        className={`min-h-4 text-xs ${
          error ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {error
          ? t("editor.saveError")
          : dirty
            ? t("editor.unsaved")
            : (savedMessage ?? copyStatus ?? "")}
      </p>
    </div>
  );
}
