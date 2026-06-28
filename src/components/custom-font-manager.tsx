import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { CustomFont } from "@/shared/styleshift";
import {
  readCustomFonts,
  updateCustomFont,
  deleteCustomFont,
} from "@/shared/styleshift";
import { useI18n } from "@/shared/i18n/use-i18n";

type CustomFontManagerProps = {
  onFontsChanged?: () => void | Promise<void>;
};

export function CustomFontManager({ onFontsChanged }: CustomFontManagerProps) {
  const { t } = useI18n();
  const [customFonts, setCustomFonts] = useState<Record<string, CustomFont>>(
    {},
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCustomFonts();
  }, []);

  async function loadCustomFonts() {
    const fonts = await readCustomFonts();
    setCustomFonts(fonts);
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;
    if (!files) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        const supportedFormats = ["woff2", "woff", "ttf", "otf"];

        if (!supportedFormats.includes(extension)) {
          console.error(
            `Unsupported font format: ${extension}. Supported formats: ${supportedFormats.join(", ")}`,
          );
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
        const fontName = file.name.replace(/\.[^.]+$/, "");
        const fontId = `custom-font-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const customFont: CustomFont = {
          id: fontId,
          name: fontName,
          data: base64,
          mimeType: file.type,
          format: extension,
        };

        await updateCustomFont(customFont);
        setCustomFonts((prev) => ({ ...prev, [fontId]: customFont }));
      }
      await onFontsChanged?.();
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteFont(fontId: string) {
    await deleteCustomFont(fontId);
    setCustomFonts((prev) => {
      const updated = { ...prev };
      delete updated[fontId];
      return updated;
    });
    await onFontsChanged?.();
  }

  return (
    <section className="space-y-3">
      <Label>{t("fonts.customFonts")}</Label>
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
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
        <p className="text-xs text-muted-foreground">
          {t("fonts.supportedFormats")}
        </p>
      </div>

      {Object.keys(customFonts).length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="space-y-2">
            <Label className="text-xs">{t("fonts.uploadedFonts")}</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.values(customFonts).map((font) => (
                <div
                  key={font.id}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {font.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {font.format.toUpperCase()}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFont(font.id)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
