import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/shared/i18n/use-i18n";
import {
  fetchGoogleFontCatalog,
  importGoogleFont,
  readGoogleApiKey,
  type GoogleFontItem,
} from "@/shared/google-fonts";
import { updateCustomFont } from "@/shared/custom-fonts";

type GoogleFontBrowserProps = {
  onImported?: () => void | Promise<void>;
  onOpenSettings?: () => void;
};

export function GoogleFontBrowser({
  onImported,
  onOpenSettings,
}: GoogleFontBrowserProps) {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<GoogleFontItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    readGoogleApiKey().then(async (key) => {
      if (!mounted) {
        return;
      }
      setApiKey(key);
      if (!key) {
        return;
      }
      try {
        const items = await fetchGoogleFontCatalog(key);
        if (mounted) {
          setCatalog(items);
        }
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? catalog.filter((font) => font.family.toLowerCase().includes(needle))
      : catalog;
    return matches.slice(0, 60);
  }, [catalog, query]);

  function openSettings() {
    if (onOpenSettings) {
      onOpenSettings();
    }
  }

  async function handleImport(family: string) {
    setImporting(family);
    setError("");
    try {
      const font = await importGoogleFont(family);
      await updateCustomFont(font);
      await onImported?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setImporting(null);
    }
  }

  if (apiKey === null) {
    return null;
  }

  if (!apiKey) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("fonts.googleNeedKey")}
        </p>
        <Button variant="outline" size="sm" onClick={openSettings}>
          {t("fonts.openSettings")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("fonts.searchGoogle")}
          className="ps-9"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {filtered.map((font) => (
          <div
            key={font.family}
            className="relative flex items-center justify-between gap-2 rounded-lg border border-transparent p-2 hover:border-[var(--fabric-stitch)] hover:bg-[var(--fabric-linen)]"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {font.family}
            </span>
            <Button
              type="button"
              variant="olive"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={importing !== null}
              onClick={() => handleImport(font.family)}
            >
              {importing === font.family ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {importing === font.family
                ? t("fonts.importing")
                : t("fonts.import")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
