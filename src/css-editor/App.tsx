import { useEffect, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  Braces,
  Copy,
  Moon,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_SETTINGS,
  getHostname,
  isInjectableUrl,
  readHostSettings,
  updateHostSettings,
} from "@/shared/styleshift";
import type { ReinjectMessage } from "@/shared/messages";
import { useTheme } from "@/shared/use-theme";
import { useI18n } from "@/shared/i18n/use-i18n";
import { formatCSS } from "./format-css";

const REINJECT_MESSAGE: ReinjectMessage = { type: "STYLESHIFT_REINJECT" };

export function CSSEditorApp() {
  const [hostname, setHostname] = useState("");
  const [customCSS, setCustomCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [savedCSS, setSavedCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    async function loadSettings() {
      try {
        // Get the hostname from the URL parameters or from the active tab
        const params = new URLSearchParams(window.location.search);
        let host = params.get("hostname");

        if (!host) {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          host = isInjectableUrl(tab.url) ? getHostname(tab.url) : "";
        }

        if (!host) {
          return;
        }

        const settings = await readHostSettings(host);
        setHostname(host);
        setCustomCSS(settings.customCSS);
        setSavedCSS(settings.customCSS);
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!hostname) return;

    setIsSaving(true);
    try {
      const formattedCSS = formatCSS(customCSS);
      const settings = await readHostSettings(hostname);
      settings.customCSS = formattedCSS;
      await updateHostSettings(hostname, settings);
      setCustomCSS(formattedCSS);
      setSavedCSS(formattedCSS);

      // Notify content script to update
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id && isInjectableUrl(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, REINJECT_MESSAGE);
        } catch {
          // Content script might not be ready, that's OK
        }
      }
    } catch (error) {
      console.error("Error saving CSS:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!hostname) return;

    try {
      const settings = await readHostSettings(hostname);
      settings.customCSS = "";
      await updateHostSettings(hostname, settings);
      setCustomCSS("");
      setSavedCSS("");

      // Notify content script to update
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
  };

  const handleReset = () => {
    setCustomCSS(savedCSS);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customCSS);
  };

  const handleFormat = () => {
    setCustomCSS(formatCSS(customCSS));
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
  };

  const hasChanges = customCSS !== savedCSS;
  const lineNumbers = customCSS.split("\n").map((_, index) => index + 1);

  return (
    <div className="min-h-screen w-full bg-background p-6 text-foreground fabric-weave">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display">{t("editor.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("editor.editingFor")}{" "}
              <span className="font-mono font-semibold">{hostname}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="gap-2"
              title={t(
                theme === "dark" ? "theme.switchToLight" : "theme.switchToDark",
              )}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.close()}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("common.close")}
            </Button>
          </div>
        </div>

        <Separator className="mb-6" />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Braces className="h-4 w-4" />
                {t("editor.customCSS")}
              </CardTitle>
              <Button
                onClick={handleFormat}
                variant="mustard"
                size="sm"
                className="gap-2"
              >
                <WandSparkles className="h-4 w-4" />
                {t("editor.format")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-fabric fabric-stitch p-1">
              <div className="flex items-center justify-between border-b border-border bg-[var(--fabric-raised)]/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>styleshift.css</span>
                <span>{t("editor.lines", { count: lineNumbers.length })}</span>
              </div>
              <div className="grid max-h-[60vh] min-h-96 grid-cols-[3.25rem_1fr] overflow-auto bg-[#2E241D] text-[#F8F3EA] dark:bg-[#1a1410]">
                <div className="select-none border-r border-[#A38362]/20 bg-black/15 py-3 pr-3 text-right font-mono text-xs leading-6 text-[#8D7C6A]">
                  {lineNumbers.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
                <textarea
                  value={customCSS}
                  onChange={(e) => setCustomCSS(e.target.value)}
                  onKeyDown={handleEditorKeyDown}
                  spellCheck={false}
                  placeholder="/* Enter your custom CSS here */
body {
  background-color: #f0f0f0;
}

.header {
  color: red;
}"
                  className="min-h-96 resize-none border-0 bg-transparent px-4 py-3 font-mono text-sm leading-6 text-[#F8F3EA] outline-none placeholder:text-[#8D7C6A] focus:ring-0"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                variant="olive"
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? t("editor.saving") : t("editor.saveCss")}
              </Button>

              <Button
                onClick={handleRemove}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t("editor.removeCss")}
              </Button>

              <Button
                onClick={handleReset}
                disabled={!hasChanges}
                variant="secondary"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {t("common.reset")}
              </Button>

              <Button onClick={handleCopy} variant="default" className="gap-2">
                <Copy className="w-4 h-4" />
                {t("common.copy")}
              </Button>
            </div>

            {hasChanges && (
              <p className="text-sm text-[#B66E5A] pt-2">
                ⚠️ {t("editor.unsaved")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
