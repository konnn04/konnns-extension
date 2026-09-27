import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

const browserLang = (navigator.language || "en").toLowerCase();
const fallback = browserLang.startsWith("vi") ? "vi" : "en";
// language setting from a previous session (persisted here to be available pre-Dexie)
const saved = localStorage.getItem("newtab.language");

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: saved ?? fallback,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: string) {
  localStorage.setItem("newtab.language", lang);
  void i18n.changeLanguage(lang);
}

/**
 * Register feature-scoped translation resources dynamically.
 * Deep-merges into the existing resource bundles for 'vi' and 'en'.
 */
export function registerI18nResources(bundles: {
  vi?: Record<string, unknown>;
  en?: Record<string, unknown>;
}): void {
  if (bundles.vi) {
    i18n.addResourceBundle("vi", "translation", bundles.vi, true, true);
  }
  if (bundles.en) {
    i18n.addResourceBundle("en", "translation", bundles.en, true, true);
  }
}

export default i18n;

