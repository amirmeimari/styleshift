import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/shared/i18n/use-i18n";
import {
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_RANGES,
  readTypography,
  updateTypography,
  type TypographySettings,
} from "@/shared/styleshift";
import {
  hasFontSettingsPermission,
  requestFontSettingsPermission,
  revokeFontSettingsPermission,
} from "@/shared/min-font-size";

// Scoped to the one thing that needs a page that survives focus loss: the
// chrome.permissions.request() gesture for "fontSettings", which an MV3
// popup cannot host (it closes as soon as the OS permission prompt or file
// dialog steals focus). Growing this into the full CSS editor / site manager
// is Phase 4 - this page stays minimal until that phase reuses it.
export function OptionsApp() {
  const { t, dir } = useI18n();
  const [typography, setTypography] =
    useState<TypographySettings>(DEFAULT_TYPOGRAPHY);
  // null while the initial permission check is in flight.
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [requestDenied, setRequestDenied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [storedTypography, granted] = await Promise.all([
        readTypography(),
        hasFontSettingsPermission(),
      ]);

      if (!mounted) {
        return;
      }

      setTypography(storedTypography);
      setHasPermission(granted);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleEnable() {
    // Requires a user gesture, which is why this control lives here rather
    // than in the popup - a popup click that opens the permission prompt
    // loses focus and Chrome tears the popup down before the answer arrives.
    const granted = await requestFontSettingsPermission();
    setHasPermission(granted);
    setRequestDenied(!granted);
  }

  async function handleMinFontSizeChange(value: number) {
    const next = await updateTypography({ minFontSize: value });
    setTypography(next);
  }

  async function handleTurnOff() {
    const next = await updateTypography({ minFontSize: null });
    setTypography(next);
  }

  async function handleRevoke() {
    await revokeFontSettingsPermission();
    setHasPermission(false);
    const next = await updateTypography({ minFontSize: null });
    setTypography(next);
  }

  return (
    <main
      dir={dir}
      className="min-h-screen bg-background text-foreground fabric-weave"
    >
      <div className="mx-auto max-w-xl p-6">
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

              {hasPermission === false && (
                <div className="space-y-2 pt-1">
                  {requestDenied && (
                    <p className="text-xs text-[var(--fabric-terracotta)]">
                      {t("options.permissionDenied")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="olive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleEnable}
                  >
                    {t("options.enablePermission")}
                  </Button>
                </div>
              )}

              {hasPermission === true && (
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
                      typography.minFontSize ??
                      TYPOGRAPHY_RANGES.minFontSize.min
                    }
                    onChange={(event) =>
                      handleMinFontSizeChange(Number(event.target.value))
                    }
                    className="w-full accent-[var(--fabric-denim)]"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleRevoke}
                    >
                      {t("options.revokePermission")}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
