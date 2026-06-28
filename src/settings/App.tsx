import { useEffect, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/shared/use-theme";
import { useI18n } from "@/shared/i18n/use-i18n";
import { LOCALES } from "@/shared/i18n/locales";
import { readGoogleApiKey, saveGoogleApiKey } from "@/shared/google-fonts";

const GOOGLE_CONSOLE_URL = "https://console.cloud.google.com/apis/credentials";

export function SettingsApp() {
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    readGoogleApiKey().then(setApiKey);
  }, []);

  async function handleSaveKey() {
    await saveGoogleApiKey(apiKey);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.subtitle")}
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
            <CardTitle>{t("settings.language")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("settings.languageHelp")}
            </p>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((option) => (
                <Button
                  key={option.code}
                  type="button"
                  variant={option.code === locale ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocale(option.code)}
                  className="gap-2"
                  aria-pressed={option.code === locale}
                >
                  {option.code === locale ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {option.nativeName}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.apiKeyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("settings.apiKeyHelp")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="google-api-key">
                {t("settings.apiKeyTitle")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="google-api-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={t("settings.apiKeyPlaceholder")}
                  className="font-mono"
                />
                <Button
                  type="button"
                  onClick={handleSaveKey}
                  className="gap-2 shrink-0"
                >
                  {justSaved ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("settings.saved")}
                    </>
                  ) : (
                    t("common.save")
                  )}
                </Button>
              </div>
            </div>
            <a
              href={GOOGLE_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("settings.getKey")}
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
