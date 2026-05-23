import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Moon, RotateCcw, Save, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { StyleShiftSettings } from "@/shared/styleshift";
import {
  DEFAULT_SETTINGS,
  getHostname,
  isInjectableUrl,
  readHostSettings,
  updateHostSettings,
} from "@/shared/styleshift";
import {
  getThemePreference,
  setThemePreference,
  type ThemeMode,
} from "@/shared/theme";

export function CSSEditorApp() {
  const [hostname, setHostname] = useState("");
  const [customCSS, setCustomCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [savedCSS, setSavedCSS] = useState(DEFAULT_SETTINGS.customCSS);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");

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

    getThemePreference().then(setTheme);
  }, []);

  const handleSave = async () => {
    if (!hostname) return;

    setIsSaving(true);
    try {
      const settings = await readHostSettings(hostname);
      settings.customCSS = customCSS;
      await updateHostSettings(hostname, settings);
      setSavedCSS(customCSS);

      // Notify content script to update
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab.id && isInjectableUrl(tab.url)) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "STYLESHIFT_REINJECT" });
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
          await chrome.tabs.sendMessage(tab.id, { type: "STYLESHIFT_REINJECT" });
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

  async function handleThemeToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    await setThemePreference(nextTheme);
  }

  const hasChanges = customCSS !== savedCSS;

  return (
    <div className="min-h-screen w-full dark:bg-zinc-950 dark:text-white bg-white text-black p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">CSS Editor</h1>
            <p className="text-sm dark:text-zinc-400 text-zinc-600 mt-1">
              Editing CSS for: <span className="font-mono font-semibold">{hostname}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleThemeToggle}
              className="gap-2"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
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
              Close
            </Button>
          </div>
        </div>

        <Separator className="mb-6" />

        <Card className="dark:bg-zinc-900 dark:border-zinc-800 bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Custom CSS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={customCSS}
              onChange={(e) => setCustomCSS(e.target.value)}
              placeholder="/* Enter your custom CSS here */
body {
  background-color: #f0f0f0;
}

.header {
  color: red;
}"
              className="font-mono min-h-96 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white bg-gray-50 border-gray-300 text-black"
            />

            <div className="flex flex-wrap gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save CSS"}
              </Button>

              <Button
                onClick={handleRemove}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remove CSS
              </Button>

              <Button
                onClick={handleReset}
                disabled={!hasChanges}
                variant="outline"
                className="gap-2 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>

              <Button
                onClick={handleCopy}
                variant="outline"
                className="gap-2 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>

            {hasChanges && (
              <p className="text-sm dark:text-amber-400 text-amber-600 pt-2">
                ⚠️ You have unsaved changes
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
