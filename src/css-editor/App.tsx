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

function formatCSS(css: string) {
  let normalized = "";
  let quote: string | null = null;
  let inComment = false;
  let parenDepth = 0;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    const previous = css[index - 1];

    if (inComment) {
      normalized += char;

      if (char === "*" && next === "/") {
        normalized += next;
        index += 1;
        inComment = false;
        normalized += "\n";
      }

      continue;
    }

    if (quote) {
      normalized += char;

      if (char === quote && previous !== "\\") {
        quote = null;
      }

      continue;
    }

    if (char === "/" && next === "*") {
      inComment = true;
      normalized += "/*";
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      normalized += char;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      normalized += char;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      normalized += char;
      continue;
    }

    if (parenDepth === 0 && (char === "{" || char === "}" || char === ";")) {
      normalized += `${char}\n`;
      continue;
    }

    normalized += char;
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let depth = 0;

  if (lines.length === 0) {
    return "";
  }

  return `${lines
    .map((line) => {
      if (line.startsWith("}")) {
        depth = Math.max(0, depth - 1);
      }

      const formatted = `${"  ".repeat(depth)}${line}`;

      if (line.endsWith("{")) {
        depth += 1;
      }

      return formatted;
    })
    .join("\n")}\n`;
}

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

  async function handleThemeToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    await setThemePreference(nextTheme);
  }

  const hasChanges = customCSS !== savedCSS;
  const lineNumbers = customCSS.split("\n").map((_, index) => index + 1);

  return (
    <div className="min-h-screen w-full bg-background p-6 text-foreground">
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Braces className="h-4 w-4" />
                Custom CSS
              </CardTitle>
              <Button
                onClick={handleFormat}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <WandSparkles className="h-4 w-4" />
                Format
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-md border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <span>styleshift.css</span>
                <span>{lineNumbers.length} lines</span>
              </div>
              <div className="grid max-h-[60vh] min-h-96 grid-cols-[3.25rem_1fr] overflow-auto bg-zinc-950 text-zinc-100 dark:bg-black">
                <div className="select-none border-r border-white/10 bg-black/25 py-3 pr-3 text-right font-mono text-xs leading-6 text-zinc-500">
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
                  className="min-h-96 resize-none border-0 bg-transparent px-4 py-3 font-mono text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-0"
                />
              </div>
            </div>

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
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>

              <Button
                onClick={handleCopy}
                variant="outline"
                className="gap-2"
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
