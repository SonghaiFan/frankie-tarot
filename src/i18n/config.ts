import { preferences } from "@/shared/storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslation from "@/i18n/locales/en.json";
import zhCNTranslation from "@/i18n/locales/zh-CN.json";
import { Locale } from "@/i18n/types";

const LOCALE_STORAGE_KEY = "mystic-tarot-locale";

const getInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "zh-CN";
  const stored = preferences.getItem(LOCALE_STORAGE_KEY);
  return stored === "en" || stored === "zh-CN" ? stored : "zh-CN";
};

i18n.use(initReactI18next).init({
  lng: getInitialLocale(),
  fallbackLng: "zh-CN",
  load: "currentOnly",
  resources: {
    en: { translation: enTranslation },
    "zh-CN": { translation: zhCNTranslation },
  },
  interpolation: {
    escapeValue: false,
  },
  missingInterpolationHandler: (_text: string, value: unknown) =>
    value === undefined ? _text : value,
});

export { LOCALE_STORAGE_KEY };
export default i18n;
