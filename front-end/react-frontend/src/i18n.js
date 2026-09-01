import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import sk from "./locales/sk/translation.json";
import uk from "./locales/uk/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      sk: {
        translation: sk
      },
      uk: {
        translation: uk
      }
    },
    supportedLngs: ["sk", "uk"],
    fallbackLng: "sk",
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"]
    }
  });

export default i18n;