import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { CustomFontManager } from "@/components/custom-font-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getThemePreference,
  setThemePreference,
  type ThemeMode,
} from "@/shared/theme";

export function FontManagerApp() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    getThemePreference().then(setTheme);
  }, []);

  async function handleThemeToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    await setThemePreference(nextTheme);
  }

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Font Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload local font files and reuse them in StyleShift.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleThemeToggle}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.close()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </header>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Uploaded fonts</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomFontManager />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
