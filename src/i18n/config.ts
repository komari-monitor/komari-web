import i18next, { type Callback } from "i18next";
import { initReactI18next } from "react-i18next";
import {
  normalizeLanguage,
  readStoredLanguage,
  writeLanguageCookie,
} from "@/utils/language";

export type SupportedLocale = "en-US" | "id-ID" | "ja-JP" | "zh-CN" | "zh-TW";

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: SupportedLocale;
  name: string;
}> = [
  { code: "en-US", name: "English" },
  { code: "id-ID", name: "Bahasa Indonesia" },
  { code: "ja-JP", name: "日本語" },
  { code: "zh-CN", name: "简体中文" },
  { code: "zh-TW", name: "繁體中文" },
];

type TranslationDict = Record<string, unknown>;

const LOCALE_LOADERS: Record<
  SupportedLocale,
  () => Promise<{ default: TranslationDict }>
> = {
  "en-US": () => import("./locales/en.json"),
  "id-ID": () => import("./locales/id_ID.json"),
  "ja-JP": () => import("./locales/ja_JP.json"),
  "zh-CN": () => import("./locales/zh_CN.json"),
  "zh-TW": () => import("./locales/zh_TW.json"),
};

const localeCache = new Map<SupportedLocale, Promise<TranslationDict>>();

export function resolveSupportedLocale(
  language?: string | null,
): SupportedLocale {
  const normalized = normalizeLanguage(language).toLowerCase();
  if (!normalized) return DEFAULT_LOCALE;

  if (
    normalized === "zh-tw" ||
    normalized === "zh-hk" ||
    normalized === "zh-mo" ||
    normalized.startsWith("zh-hant")
  ) {
    return "zh-TW";
  }
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return "zh-CN";
  }
  if (normalized === "ja" || normalized.startsWith("ja-")) {
    return "ja-JP";
  }
  if (normalized === "id" || normalized.startsWith("id-")) {
    return "id-ID";
  }
  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en-US";
  }

  return DEFAULT_LOCALE;
}

function detectInitialLocale(): SupportedLocale {
  const stored = readStoredLanguage();
  if (stored) {
    return resolveSupportedLocale(stored);
  }

  if (typeof navigator !== "undefined") {
    const candidates =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];
    for (const candidate of candidates) {
      const normalized = normalizeLanguage(candidate).toLowerCase();
      if (!normalized) continue;
      if (
        normalized === "zh" ||
        normalized.startsWith("zh-") ||
        normalized === "ja" ||
        normalized.startsWith("ja-") ||
        normalized === "id" ||
        normalized.startsWith("id-") ||
        normalized === "en" ||
        normalized.startsWith("en-")
      ) {
        return resolveSupportedLocale(normalized);
      }
    }
  }

  return DEFAULT_LOCALE;
}

export function loadLocaleBundle(
  locale: SupportedLocale,
): Promise<TranslationDict> {
  const cached = localeCache.get(locale);
  if (cached) return cached;

  const promise = LOCALE_LOADERS[locale]()
    .then((mod) => mod.default)
    .catch((error) => {
      localeCache.delete(locale);
      throw error;
    });
  localeCache.set(locale, promise);
  return promise;
}

async function ensureLocaleRegistered(locale: SupportedLocale): Promise<void> {
  if (i18next.hasResourceBundle(locale, "translation")) {
    return;
  }
  const bundle = await loadLocaleBundle(locale);
  i18next.addResourceBundle(locale, "translation", bundle, true, true);
}

writeLanguageCookie(readStoredLanguage());

i18next.on("languageChanged", (language) => {
  writeLanguageCookie(language);
});

const originalChangeLanguage = i18next.changeLanguage.bind(i18next);
i18next.changeLanguage = (async (
  lng?: string,
  callback?: Callback,
) => {
  const target = resolveSupportedLocale(lng);
  try {
    await ensureLocaleRegistered(target);
  } catch (error) {
    console.error(`Failed to load locale bundle "${target}":`, error);
  }
  return originalChangeLanguage(target, callback);
}) as typeof i18next.changeLanguage;

const i18n = i18next;
let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const initialLocale = detectInitialLocale();
    let initialBundle: TranslationDict = {};
    let activeLocale: SupportedLocale = initialLocale;

    try {
      initialBundle = await loadLocaleBundle(initialLocale);
    } catch (error) {
      console.error(`Failed to load initial locale "${initialLocale}":`, error);
      if (initialLocale !== DEFAULT_LOCALE) {
        try {
          initialBundle = await loadLocaleBundle(DEFAULT_LOCALE);
          activeLocale = DEFAULT_LOCALE;
        } catch (fallbackError) {
          console.error("Failed to load fallback locale:", fallbackError);
        }
      }
    }

    await i18n.use(initReactI18next).init({
      lng: activeLocale,
      fallbackLng: DEFAULT_LOCALE,
      resources: {
        [activeLocale]: {
          translation: initialBundle,
        },
      },
      interpolation: {
        escapeValue: false, // React handles XSS
      },
      saveMissing: true,
      missingKeyHandler: () => {
        // Lazily load English fallback bundle only if a translation key is ever missing.
        if (!i18n.hasResourceBundle(DEFAULT_LOCALE, "translation")) {
          void ensureLocaleRegistered(DEFAULT_LOCALE).catch(() => undefined);
        }
      },
    });

    writeLanguageCookie(activeLocale);
    return i18n;
  })();

  return initPromise;
}

export default i18n;
