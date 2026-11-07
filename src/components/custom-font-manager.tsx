import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { CustomFont } from "@/shared/styleshift";
import {
  readCustomFonts,
  updateCustomFont,
  deleteCustomFont,
} from "@/shared/styleshift";
import { validateFontData } from "@/shared/font-validation";
import { fontFormatHint } from "@/shared/style-core";
import { useI18n } from "@/shared/i18n/use-i18n";

type CustomFontManagerProps = {
  onFontsChanged?: () => void | Promise<void>;
  searchQuery?: string;
};

export function CustomFontManager({
  onFontsChanged,
  searchQuery = "",
}: CustomFontManagerProps) {
  const { t } = useI18n();
  const [customFonts, setCustomFonts] = useState<Record<string, CustomFont>>(
    {},
  );
  const [fontValidation, setFontValidation] = useState<
    Record<string, { font: CustomFont; status: "valid" | "invalid" }>
  >({});
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCustomFonts();
  }, []);

  // Recheck stored/imported bytes, without changing backups or deleting data.
  // Discard late results when the library changes or this view unmounts.
  useEffect(() => {
    let cancelled = false;
    for (const font of Object.values(customFonts)) {
      void validateFontData(font.data).then(
        () => record("valid"),
        () => record("invalid"),
      );
      function record(status: "valid" | "invalid") {
        if (!cancelled) {
          setFontValidation((previous) => ({
            ...previous,
            [font.id]: { font, status },
          }));
        }
      }
    }
    return () => {
      cancelled = true;
    };
  }, [customFonts]);

  async function loadCustomFonts() {
    const fonts = await readCustomFonts();
    setCustomFonts(fonts);
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;
    if (!files) return;

    setIsUploading(true);
    setMessage(null);
    let uploadedCount = 0;
    let validationError: string | null = null;
    try {
      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        const supportedFormats = ["woff2", "woff", "ttf", "otf"];

        if (!supportedFormats.includes(extension)) {
          validationError ??= t("fonts.unsupportedFormat", { name: file.name });
          continue;
        }

        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Unable to read font file."));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const base64 = result.split(",")[1] || result;
        try {
          await validateFontData(base64);
        } catch {
          validationError ??= t("fonts.invalidFont", { name: file.name });
          continue;
        }
        const fontName = file.name.replace(/\.[^.]+$/, "");
        // Re-uploading a font under a name that already exists should replace
        // it. Minting a fresh timestamp id every time left two @font-face
        // blocks declaring the same family, with the later one silently
        // winning and the earlier one wasting storage forever.
        const existing = Object.values(await readCustomFonts()).find(
          (font) => font.name.toLowerCase() === fontName.toLowerCase(),
        );
        const fontId =
          existing?.id ??
          `custom-font-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const customFont: CustomFont = {
          id: fontId,
          name: fontName,
          data: base64,
          mimeType: file.type || fontFormatHint(extension).mimeType,
          format: extension,
        };

        await updateCustomFont(customFont);
        setCustomFonts((prev) => ({ ...prev, [fontId]: customFont }));
        uploadedCount += 1;
      }
      if (uploadedCount > 0) await onFontsChanged?.();
      if (validationError) {
        setMessage({ kind: "error", text: validationError });
      } else if (uploadedCount > 0) {
        setMessage({
          kind: "success",
          text: t("fonts.uploadSuccess", { count: uploadedCount }),
        });
      }
    } catch (error) {
      console.error("Error uploading custom font:", error);
      setMessage({
        kind: "error",
        text: t("fonts.uploadError"),
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteFont(fontId: string) {
    setMessage(null);
    try {
      await deleteCustomFont(fontId);
      setCustomFonts((prev) => {
        const updated = { ...prev };
        delete updated[fontId];
        return updated;
      });
      await onFontsChanged?.();
      setMessage({ kind: "success", text: t("fonts.deleteSuccess") });
    } catch (error) {
      console.error("Error deleting custom font:", error);
      setMessage({ kind: "error", text: t("fonts.deleteError") });
    }
  }

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredFonts = Object.values(customFonts).filter((font) =>
    font.name.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-dashed border-border bg-card p-3 text-center">
        <Button
          type="button"
          variant="default"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? t("fonts.uploading") : t("fonts.uploadFont")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".woff2,.woff,.ttf,.otf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {t("fonts.supportedFormats")}
        </p>
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "text-xs text-destructive"
              : "flex items-center gap-1.5 text-xs text-[var(--fabric-green-thread)]"
          }
        >
          {message.kind === "success" && (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {message.text}
        </p>
      )}

      {Object.keys(customFonts).length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="space-y-2">
            <Label className="text-xs">{t("fonts.uploadedFonts")}</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {filteredFonts.map((font) => {
                const validation = fontValidation[font.id];
                const status =
                  validation?.font === font ? validation.status : undefined;
                return (
                  <div
                    key={font.id}
                    className="relative flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-medium"
                        style={{
                          fontFamily: `'${font.name.replace(/'/g, "\\'")}', sans-serif`,
                        }}
                      >
                        {font.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {font.format.toUpperCase()} ·{" "}
                        {t(
                          status === "valid"
                            ? "availability.uploadedValid"
                            : status === "invalid"
                              ? "availability.uploadedInvalid"
                              : "availability.uploadedChecking",
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteFont(font.id)}
                      className="h-8 w-8 shrink-0"
                      aria-label={t("fonts.deleteFont", { name: font.name })}
                      title={t("fonts.deleteFont", { name: font.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {filteredFonts.length === 0 && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  {t("fonts.noUploadedMatches")}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
