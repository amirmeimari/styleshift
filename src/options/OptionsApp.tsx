import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Download, Save, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/shared/i18n/use-i18n";
import {
  backupFilename,
  isHostSettingsKey,
  parseBackup,
  serializeBackup,
  type StyleShiftBackup,
} from "@/shared/backup";
import { applyBackup, collectBackup } from "@/shared/backup-storage";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_RANGES,
  type StyleShiftSettings,
  type TypographySettings,
} from "@/shared/style-core";
import {
  clearHostSettings,
  readGlobalCSS,
  readTypography,
  resolveHostSettings,
  updateGlobalCSS,
  updateHostSettings,
  updateTypography,
} from "@/shared/storage";

const CssEditor = lazy(() =>
  import("@/css-editor/css-editor").then((module) => ({
    default: module.CssEditor,
  })),
);

type SiteRow = { host: string; settings: StyleShiftSettings };

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadSiteRows(): Promise<SiteRow[]> {
  const all = (await chrome.storage.local.get(null)) as Record<string, unknown>;
  return Object.entries(all)
    .filter(
      ([key, value]) =>
        isHostSettingsKey(key) && value && typeof value === "object",
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

// Scoped originally to the one thing that needed a page that survives focus
// loss - the OS file picker for import - this page now also hosts the site
// manager and the full-tab CSS editor, which needs the same property to edit
// CSS without the popup's 480px ceiling.
export function OptionsApp() {
  const { t, dir } = useI18n();
  const [typography, setTypography] =
    useState<TypographySettings>(DEFAULT_TYPOGRAPHY);

  const [sites, setSites] = useState<SiteRow[]>([]);

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

  const [globalCSS, setGlobalCSS] = useState("");
  const [globalCSSDraft, setGlobalCSSDraft] = useState("");
  const [showGlobalCssEditor, setShowGlobalCssEditor] = useState(false);
  const [globalCssSaved, setGlobalCssSaved] = useState<string | null>(null);

  async function refreshSites() {
    setSites(await loadSiteRows());
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [storedTypography, siteRows, storedGlobalCSS] = await Promise.all([
        readTypography(),
        loadSiteRows(),
        readGlobalCSS(),
      ]);

      if (!mounted) {
        return;
      }

      setTypography(storedTypography);
      setSites(siteRows);
      setGlobalCSS(storedGlobalCSS);
      setGlobalCSSDraft(storedGlobalCSS);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // A "pop out" button on the popup's CSS tab opens this page at
  // options.html?host=<hostname> so it lands straight in that site's editor.
  useEffect(() => {
    const host = new URLSearchParams(window.location.search).get("host");
    if (host) {
      openEditor(host);
    }
  }, []);

  async function handleMinFontSizeChange(value: number) {
    const next = await updateTypography({ minFontSize: value });
    setTypography(next);
  }

  async function handleTurnOff() {
    const next = await updateTypography({ minFontSize: null });
    setTypography(next);
  }

  async function handleExport() {
    setExportError(null);
    try {
      const backup = await collectBackup(exportIncludeFonts);
      const json = serializeBackup(backup);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFilename(new Date());
      a.click();
      // Delayed rather than immediate: revoking synchronously can race the
      // browser's own read of the object URL for the download.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setExportStatus(formatBytes(blob.size));
    } catch {
      setExportError(t("options.exportError"));
    }
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-choosing the same file later
    if (!file) {
      return;
    }

    setImportSuccess(null);
    const text = await file.text();
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
    if (!importPreview) {
      return;
    }
    try {
      const report = await applyBackup(importPreview.backup, importMode);
      setImportPreview(null);
      setImportSuccess(
        t("options.importSuccess", { sites: report.sitesWritten }),
      );
      const [storedTypography, siteRows, storedGlobalCSS] = await Promise.all([
        readTypography(),
        loadSiteRows(),
        readGlobalCSS(),
      ]);
      setTypography(storedTypography);
      setSites(siteRows);
      setGlobalCSS(storedGlobalCSS);
      setGlobalCSSDraft(storedGlobalCSS);
      // The import may have changed or removed the host currently open in
      // the CSS editor below - re-resolve it so a stale draft can't be
      // saved back over what was just imported.
      if (editingHost) {
        await openEditor(editingHost);
      }
    } catch {
      setImportError(t("options.importErrorApplyFailed"));
    }
  }

  function handleCancelImport() {
    setImportPreview(null);
    setImportError(null);
  }

  async function handleDeleteSite(host: string) {
    await clearHostSettings(host);
    await refreshSites();
    if (editingHost === host) {
      closeEditor();
    }
  }

  async function handleClearAllSites() {
    if (sites.length === 0) {
      return;
    }
    if (!window.confirm(t("options.clearAllConfirm"))) {
      return;
    }
    await chrome.storage.local.remove(sites.map((site) => site.host));
    await refreshSites();
    closeEditor();
  }

  async function openEditor(host: string) {
    const resolved = await resolveHostSettings(host);
    setEditingHost(host);
    setEditingSettings(resolved.settings);
    setEditingDraft(resolved.settings.customCSS);
    setEditingSaved(null);
  }

  function closeEditor() {
    setEditingHost(null);
    setEditingSettings(null);
    setEditingDraft("");
    setEditingSaved(null);
  }

  async function handleSaveEditingCSS() {
    if (!editingHost || !editingSettings) {
      return;
    }
    const next: StyleShiftSettings = {
      ...editingSettings,
      customCSS: editingDraft,
    };
    await updateHostSettings(editingHost, next);
    setEditingSettings(next);
    setEditingSaved(t("options.cssEditorSavedFor", { host: editingHost }));
    await refreshSites();
  }

  function toggleGlobalCssEditor() {
    setShowGlobalCssEditor((open) => !open);
    setGlobalCssSaved(null);
  }

  async function handleSaveGlobalCSS() {
    await updateGlobalCSS(globalCSSDraft);
    setGlobalCSS(globalCSSDraft);
    setGlobalCssSaved(t("options.globalCssSaved"));
  }

  return (
    <main
      dir={dir}
      className="min-h-screen bg-background text-foreground fabric-weave"
    >
      <div className={`mx-auto p-6 ${editingHost ? "max-w-3xl" : "max-w-xl"}`}>
        <Card className="border-border bg-transparent shadow-none !bg-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="StyleShift"
                className="h-10 object-contain"
              />
              <h1 className="text-lg font-display">{t("options.title")}</h1>
            </div>

            <Separator />

            <section className="space-y-2">
              <Label className="text-sm font-semibold">
                {t("options.minFontSizeTitle")}
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("options.minFontSizeHelp")}
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="min-font-size"
                    className="text-xs text-muted-foreground"
                  >
                    {t("options.minFontSizeLabel")}
                  </Label>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
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
                    typography.minFontSize ?? TYPOGRAPHY_RANGES.minFontSize.min
                  }
                  onChange={(event) =>
                    handleMinFontSizeChange(Number(event.target.value))
                  }
                  className="w-full accent-[var(--fabric-denim)]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={typography.minFontSize === null}
                  onClick={handleTurnOff}
                >
                  {t("options.turnOff")}
                </Button>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">
                  {t("options.backupTitle")}
                </Label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("options.backupHelp")}
                </p>
              </div>

              <div className="space-y-2 rounded-md border border-border bg-[var(--fabric-linen)] p-3">
                <Label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={exportIncludeFonts}
                    onChange={(event) =>
                      setExportIncludeFonts(event.target.checked)
                    }
                  />
                  {t("options.exportIncludeFonts")}
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="olive"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={handleExport}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("options.exportSettings")}
                  </Button>
                  {exportStatus && (
                    <span className="text-[10px] text-muted-foreground">
                      {t("options.exportSizeEstimate", { size: exportStatus })}
                    </span>
                  )}
                </div>
                {exportError && (
                  <p className="text-xs text-[var(--fabric-terracotta)]">
                    {exportError}
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-md border border-border bg-[var(--fabric-linen)] p-3">
                <p className="text-xs text-muted-foreground">
                  {t("options.importHelp")}
                </p>
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
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("options.chooseFile")}
                </Button>

                {importError && (
                  <p className="text-xs text-[var(--fabric-terracotta)]">
                    {importError}
                  </p>
                )}
                {importSuccess && (
                  <p className="text-xs text-[var(--fabric-olive)]">
                    {importSuccess}
                  </p>
                )}

                {importPreview && (
                  <div className="space-y-2 rounded-md border border-border bg-[var(--fabric-canvas)] p-2">
                    <p className="text-xs font-semibold">
                      {t("options.importPreviewSummary", {
                        sites: Object.keys(importPreview.backup.sites).length,
                        fonts: importPreview.backup.fonts?.length ?? 0,
                      })}
                    </p>

                    {importPreview.warnings.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-[var(--fabric-terracotta)]">
                          {t("options.importWarnings")}
                        </p>
                        <ul className="list-inside list-disc text-[10px] text-muted-foreground">
                          {importPreview.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs">
                      <Label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="import-mode"
                          checked={importMode === "merge"}
                          onChange={() => setImportMode("merge")}
                        />
                        {t("options.importModeMerge")}
                      </Label>
                      <Label className="flex items-center gap-1.5">
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
                      <p className="text-[10px] text-[var(--fabric-terracotta)]">
                        {t("options.importModeReplaceWarning")}
                      </p>
                    )}

                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="olive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleConfirmImport}
                      >
                        {t("options.importConfirm")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleCancelImport}
                      >
                        {t("common.close")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-sm font-semibold">
                    {t("options.globalCssTitle")}
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("options.globalCssHelp")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={toggleGlobalCssEditor}
                >
                  {t("options.editGlobalCss")}
                </Button>
              </div>

              {showGlobalCssEditor && (
                <div className="space-y-2">
                  <Suspense
                    fallback={
                      <div className="min-h-[200px] w-full rounded-lg border border-border bg-card shadow-fabric" />
                    }
                  >
                    <CssEditor
                      value={globalCSSDraft}
                      onChange={setGlobalCSSDraft}
                      className="min-h-[200px]"
                    />
                  </Suspense>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="olive"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={globalCSSDraft === globalCSS}
                      onClick={handleSaveGlobalCSS}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {t("common.save")}
                    </Button>
                    {globalCssSaved && (
                      <span className="text-[10px] text-[var(--fabric-olive)]">
                        {globalCssSaved}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-sm font-semibold">
                    {t("options.sitesTitle")}
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("options.sitesHelp")}
                  </p>
                </div>
                {sites.length > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 text-xs"
                    onClick={handleClearAllSites}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("options.clearAllSites")}
                  </Button>
                )}
              </div>

              {sites.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("options.sitesEmpty")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {sites.map(({ host, settings }) => (
                    <li
                      key={host}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-[var(--fabric-linen)] px-2 py-1.5"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold">
                          {host}
                        </span>
                        <Badge
                          variant={settings.fontEnabled ? "olive" : "outline"}
                          className="px-1.5 py-0 text-[9px]"
                        >
                          {t(
                            settings.fontEnabled
                              ? "options.statusOn"
                              : "options.statusOff",
                          )}
                        </Badge>
                        <Badge
                          variant={
                            settings.cssEnabled && settings.customCSS
                              ? "info"
                              : "outline"
                          }
                          className="px-1.5 py-0 text-[9px]"
                        >
                          {formatBytes(new Blob([settings.customCSS]).size)}
                        </Badge>
                        {settings.includeSubdomains !== false && (
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[9px]"
                          >
                            {t("options.siteIncludeSubdomains")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => openEditor(host)}
                        >
                          {t("options.editCss")}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => handleDeleteSite(host)}
                        >
                          {t("options.deleteSite")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {editingHost && editingSettings && (
              <>
                <Separator />
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      {t("editor.editingFor")}{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {editingHost}
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-6 gap-1 text-[10px]"
                      onClick={closeEditor}
                    >
                      <X className="h-3 w-3" />
                      {t("common.close")}
                    </Button>
                  </div>

                  <Suspense
                    fallback={
                      <div className="min-h-[240px] w-full rounded-lg border border-border bg-card shadow-fabric" />
                    }
                  >
                    <CssEditor
                      value={editingDraft}
                      onChange={setEditingDraft}
                      className="min-h-[240px]"
                    />
                  </Suspense>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="olive"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={editingDraft === editingSettings.customCSS}
                      onClick={handleSaveEditingCSS}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {t("common.save")}
                    </Button>
                    {editingSaved && (
                      <span className="text-[10px] text-[var(--fabric-olive)]">
                        {editingSaved}
                      </span>
                    )}
                  </div>
                </section>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
