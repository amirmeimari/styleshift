import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocaleCode,
  localeDir,
  type LocaleCode,
} from "./locales";
import { translate, type MessageVars } from "./translations";

type I18nContextValue = {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  setLocale: (locale: LocaleCode) => Promise<void>;
  t: (key: string, vars?: MessageVars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

async function readStoredLocale(): Promise<LocaleCode> {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
      const value = stored[LOCALE_STORAGE_KEY];
      if (isLocaleCode(value)) {
        return value;
      }
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_LOCALE;
}

function applyDocumentLocale(locale: LocaleCode) {
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDir(locale);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    let mounted = true;

    readStoredLocale().then((stored) => {
      if (!mounted) {
        return;
      }
      setLocaleState(stored);
      applyDocumentLocale(stored);
    });

    // Keep every open page in sync when the language changes elsewhere.
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[LOCALE_STORAGE_KEY]) {
        return;
      }
      const next = changes[LOCALE_STORAGE_KEY].newValue;
      if (isLocaleCode(next)) {
        setLocaleState(next);
        applyDocumentLocale(next);
      }
    };

    chrome.storage?.onChanged?.addListener(onChanged);
    return () => {
      mounted = false;
      chrome.storage?.onChanged?.removeListener(onChanged);
    };
  }, []);

  const setLocale = useCallback(async (next: LocaleCode) => {
    setLocaleState(next);
    applyDocumentLocale(next);
    try {
      await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: next });
    } catch {
      // localStorage-free fallback: in-memory state is already updated.
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: MessageVars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: localeDir(locale), setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
