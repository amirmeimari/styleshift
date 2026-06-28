import { useState } from "react";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { CustomFontManager } from "@/components/custom-font-manager";
import { GoogleFontBrowser } from "@/components/google-font-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/shared/use-theme";
import { useI18n } from "@/shared/i18n/use-i18n";
import { BUILTIN_FONTS } from "@/shared/builtin-fonts";

export function FontManagerApp() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  // Bump to refresh the uploaded-fonts list after a Google Fonts import.
  const [importNonce, setImportNonce] = useState(0);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("fonts.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("fonts.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={t(
                theme === "dark" ? "theme.switchToLight" : "theme.switchToDark",
              )}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.close()}>
              <ArrowLeft className="me-2 h-4 w-4" />
              {t("common.close")}
            </Button>
          </div>
        </header>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>{t("fonts.bundledTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("fonts.bundledSubtitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {BUILTIN_FONTS.map((font) => (
                <span
                  key={font.name}
                  className="rounded-full border bg-secondary/50 px-3 py-1 text-sm"
                >
                  {font.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("fonts.customFonts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomFontManager key={importNonce} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("fonts.googleTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GoogleFontBrowser
              onImported={() => setImportNonce((value) => value + 1)}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
