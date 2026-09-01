import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import feature2GifLight from "../assets/dragon_images/gif1_dragon.gif";
import feature1GifLight from "../assets/dragon_images/gif2_dragon.gif";
import feature3GifLight from "../assets/dragon_images/gif3_dragon.gif";
import feature4GifLight from "../assets/dragon_images/gif5_dragon.gif";
import feature5GifLight from "../assets/dragon_images/gif4_dragon.gif";

import feature2GifDark from "../assets/dragon_images_dark/gif1_dragon.gif";
import feature1GifDark from "../assets/dragon_images_dark/gif2_dragon.gif";
import feature3GifDark from "../assets/dragon_images_dark/gif3_dragon.gif";
import feature4GifDark from "../assets/dragon_images_dark/gif5_dragon.gif";
import feature5GifDark from "../assets/dragon_images_dark/gif4_dragon.gif";

const Index = ({ highlight }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const syncTheme = () => {
      const saved = localStorage.getItem("theme");
      const isDark = document.body.classList.contains("dark") || saved === "dark";
      setTheme(isDark ? "dark" : "light");
    };

    syncTheme();

    const observer = new MutationObserver(() => {
      syncTheme();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("storage", syncTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const features = useMemo(() => {
    const gifs =
      theme === "dark"
        ? {
            f1: feature1GifDark,
            f2: feature2GifDark,
            f3: feature3GifDark,
            f4: feature4GifDark,
            f5: feature5GifDark,
          }
        : {
            f1: feature1GifLight,
            f2: feature2GifLight,
            f3: feature3GifLight,
            f4: feature4GifLight,
            f5: feature5GifLight,
          };

    return [
      { id: "f1", gif: gifs.f1 },
      { id: "f2", gif: gifs.f2 },
      { id: "f3", gif: gifs.f3 },
      { id: "f4", gif: gifs.f4 },
      { id: "f5", gif: gifs.f5 },
    ];
  }, [theme]);

  const faqs = useMemo(
    () => [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }],
    []
  );

  const reviews = useMemo(
    () => [{ id: "r1" }, { id: "r2" }, { id: "r3" }, { id: "r4" }, { id: "r5" }, { id: "r6" }],
    []
  );

  return (
    <>
      <div className="section hero-section">
        <h1>{t("index.heroTitle")}</h1>
        <h2>{t("index.heroSubtitle")}</h2>

        <p className="hero-subtitle">{t("index.welcome")}</p>

        <div className="hero-buttons">
          <button
            className={`primary-button ${highlight ? "highlight" : ""}`}
            onClick={() => navigate("/teacher/upload")}
          >
            {t("index.iAmTeacher")}
          </button>

          <button
            className={`secondary-button ${highlight ? "highlight" : ""}`}
            onClick={() => navigate("/student")}
          >
            {t("index.iAmStudent")}
          </button>
        </div>
      </div>

      <div className="section features-section">
        <h3>{t("index.featuresTitle")}</h3>

        <div className="feature-list">
          {features.map((feature) => (
            <div className="feature-item" key={feature.id}>
              <div className="feature-header">
                <div className="feature-text">
                  <div className="feature-title">{t(`features.${feature.id}.title`)}</div>
                  <div className="feature-subtitle">{t(`features.${feature.id}.subtitle`)}</div>
                </div>
              </div>

              <div className="feature-gif-box">
                <img
                  src={feature.gif}
                  alt={t(`features.${feature.id}.title`)}
                  className="feature-gif"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section faq-section">
        <h3 className="faq-heading">{t("index.faqTitle")}</h3>
        <p className="faq-subtitle">{t("index.faqSubtitle")}</p>

        <div className="faq-list">
          {faqs.map((faq, index) => {
            const isActive = activeIndex === index;

            return (
              <div key={faq.id} className={`faq-item ${isActive ? "active" : ""}`}>
                <button
                  className="faq-question"
                  onClick={() => setActiveIndex(isActive ? null : index)}
                >
                  <span>{t(`faq.${faq.id}.question`)}</span>
                  <span className="faq-icon">{isActive ? "−" : "+"}</span>
                </button>

                {isActive && (
                  <div className="faq-answer">
                    <p>{t(`faq.${faq.id}.answer`)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section reviews-section">
        <h3>{t("index.reviewsTitle")}</h3>

        <div className="reviews-grid">
          {reviews.map((r) => (
            <article className="review-card" key={r.id}>
              <div className="stars">★★★★★</div>
              <h4>{t(`reviews.${r.id}.title`)}</h4>
              <p>{t(`reviews.${r.id}.text`)}</p>
              <div className="review-footer">
                <span className="review-name">{t(`reviews.${r.id}.name`)}</span>
                <span className="review-date">{t(`reviews.${r.id}.date`)}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
};

export default Index;