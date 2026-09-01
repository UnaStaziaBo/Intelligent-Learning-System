import React from "react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";

export default function LanguageSwitcher() {
  const { t } = useTranslation();
  const current = (i18n.language || "sk").slice(0, 2);

  return (
    <div className="lang-switch">
      <button
        type="button"
        className={`lang-btn ${current === "sk" ? "active" : ""}`}
        onClick={() => i18n.changeLanguage("sk")}
        aria-label="Switch language to Slovak"
      >
        {t("lang.sk")}
      </button>

      <button
        type="button"
        className={`lang-btn ${current === "uk" ? "active" : ""}`}
        onClick={() => i18n.changeLanguage("uk")}
        aria-label="Switch language to Ukrainian"
      >
        {t("lang.uk")}
      </button>
    </div>
  );
}