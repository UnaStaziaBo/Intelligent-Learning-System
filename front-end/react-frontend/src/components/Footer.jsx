import React from "react";
import "./Footer.css";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Footer = ({ setHighlight }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goToHomeWithHighlight = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    setTimeout(() => {
      setHighlight(true);
      setTimeout(() => setHighlight(false), 400);
    }, 500);

    navigate("/");
  };

  return (
    <footer className="section footer-section">
      <div className="footer-columns">
        <div className="footer-column">
          <div className="footer-title">{t("footer.brand")}</div>
        </div>

        <div className="footer-column">
          <div className="footer-title">{t("footer.discover.title")}</div>

          <button className="footer-link" onClick={goToHomeWithHighlight}>
            {t("footer.discover.links")}
          </button>

          <button className="footer-link" onClick={goToHomeWithHighlight}>
            {t("footer.discover.resources")}
          </button>

          <button className="footer-link" onClick={goToHomeWithHighlight}>
            {t("footer.discover.examples")}
          </button>
        </div>

        <div className="footer-column">
          <div className="footer-title">{t("footer.system.title")}</div>

          <button className="footer-link" onClick={goToHomeWithHighlight}>
            {t("footer.system.intro")}
          </button>

          <button className="footer-link" onClick={goToHomeWithHighlight}>
            {t("footer.system.createTasks")}
          </button>

          <button className="footer-link" onClick={goToHomeWithHighlight}>
            {t("footer.system.doTasks")}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;