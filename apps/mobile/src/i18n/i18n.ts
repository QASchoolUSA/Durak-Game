import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import { deviceLanguage, resolveAppLanguage } from "./resolveLanguage";
import type { LanguagePreference } from "./languageStorage";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  uk: { translation: uk },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: "en",
  supportedLngs: ["en", "ru", "uk"],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  compatibilityJSON: "v4",
});

/** Apply a stored language preference to the shared i18n instance. */
export function applyLanguagePreference(preference: LanguagePreference): void {
  const lng = resolveAppLanguage(preference);
  if (i18n.language !== lng) {
    void i18n.changeLanguage(lng);
  }
}

export { i18n };
export default i18n;
