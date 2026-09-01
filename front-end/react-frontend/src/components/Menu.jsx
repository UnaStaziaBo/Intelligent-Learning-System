import React from "react";
import "./Menu.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/LanguageSwitcher";

const Menu = ({ setHighlight }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const goHomeWithHighlight = () => {
    navigate("/");
    setHighlight(false);
    setTimeout(() => setHighlight(true), 50);
    setTimeout(() => setHighlight(false), 450);
  };

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <div className="logo" onClick={goHomeWithHighlight}>
          {t("menu.logo")}
        </div>
      </div>

      <div className="top-bar-right">
        {/* Language switcher in menu */}
        <LanguageSwitcher />

        <button
          className="icon-button"
          onClick={() => {
            document.body.classList.toggle("dark");
            localStorage.setItem(
              "theme",
              document.body.classList.contains("dark") ? "dark" : "light"
            );
          }}
          aria-label={t("menu.toggleThemeAria")}
          title={t("menu.toggleThemeTitle")}
        >
          🌙
        </button>

        {user ? (
        <button
            className="primary-button small danger"
            onClick={() => {
            logout();
            navigate("/");
            }}
        >
            {t("menu.logout")}
        </button>
        ) : null}
      </div>
    </header>
  );
};

export default Menu;