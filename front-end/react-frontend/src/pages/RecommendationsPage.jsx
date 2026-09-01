import React, { useEffect, useMemo, useState } from "react";
import "./RecommendationsPage.css";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import gif1Light from "../assets/dragon_images/gif1_dragon.gif";
import gif2Light from "../assets/dragon_images/gif2_dragon.gif";
import gif3Light from "../assets/dragon_images/gif3_dragon.gif";
import gif4Light from "../assets/dragon_images/gif5_dragon.gif";
import gif5Light from "../assets/dragon_images/gif4_dragon.gif";

import gif1Dark from "../assets/dragon_images_dark/gif1_dragon.gif";
import gif2Dark from "../assets/dragon_images_dark/gif2_dragon.gif";
import gif3Dark from "../assets/dragon_images_dark/gif3_dragon.gif";
import gif4Dark from "../assets/dragon_images_dark/gif5_dragon.gif";
import gif5Dark from "../assets/dragon_images_dark/gif4_dragon.gif";

const API_BASE = "";

const apiUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return API_BASE + (path.startsWith("/") ? path : `/${path}`);
};

async function getBatchStatus(batchId) {
  const resp = await fetch(`${API_BASE}/api/batch/${encodeURIComponent(batchId)}/status`);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Status HTTP ${resp.status}: ${text || "no body"}`);
  return JSON.parse(text);
}

async function fetchJson(url) {
  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) throw new Error(text || `HTTP ${resp.status}`);
  return JSON.parse(text);
}

function pickConclusion(notesJson) {
  if (!notesJson) return "";

  if (typeof notesJson.conclusion === "string") return notesJson.conclusion;
  if (typeof notesJson?.summary?.conclusion === "string") return notesJson.summary.conclusion;
  if (typeof notesJson?.conclusion?.text === "string") return notesJson.conclusion.text;

  const sec = Array.isArray(notesJson.sections)
    ? notesJson.sections.find((s) => String(s?.title || "").toLowerCase().includes("concl"))
    : null;

  if (typeof sec?.text === "string") return sec.text;

  return "";
}

const RecommendationsPage = () => {
  const { t } = useTranslation();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  const GIFS = useMemo(() => {
    return theme === "dark"
      ? [gif1Dark, gif2Dark, gif3Dark, gif4Dark, gif5Dark]
      : [gif1Light, gif2Light, gif3Light, gif4Light, gif5Light];
  }, [theme]);

  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const batchId = params.get("batch") || "";
  const courseId = params.get("course");
  const mode = params.get("mode");
  const stemFromUrl = params.get("stem") || "";

  const savedAccess = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("studentAccess") || "null");
    } catch {
      return null;
    }
  }, []);

  const stem = stemFromUrl || savedAccess?.stem || "";
  const displayName = savedAccess?.displayName || stem || t("recommendations.studentFallback");

  const pdfUrl =
    savedAccess?.pdf?.url ||
    (batchId && stem ? `/api/batch/${encodeURIComponent(batchId)}/pdf/${encodeURIComponent(stem)}.pdf` : "");

  const notesUrl =
    savedAccess?.notes?.url ||
    (batchId && stem
      ? `/api/batch/${encodeURIComponent(batchId)}/notes/${encodeURIComponent(stem)}_notes.json`
      : "");

  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const [genState, setGenState] = useState("idle"); // idle | running | done | error
  const [genErr, setGenErr] = useState("");
  const [stageText, setStageText] = useState("");
  const [gifIndex, setGifIndex] = useState(0);

  const [conclusion, setConclusion] = useState("");
  const [notesErr, setNotesErr] = useState("");

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

  const handleOpenRating = () => setIsRatingOpen(true);

  const handleSubmitRating = () => {
    console.log("Overall sheet rating:", { courseId, mode, rating: overallRating, comment });

    setIsRatingOpen(false);
    setOverallRating(0);
    setComment("");

    setRatingSubmitted(true);
    setTimeout(() => setRatingSubmitted(false), 2000);
  };

  const handleHomeClick = () => navigate("/");

  const handleBackToTasks = () => {
    const query = new URLSearchParams();
    if (courseId) query.set("course", courseId);
    if (mode) query.set("mode", mode);
    if (batchId) query.set("batch", batchId);
    if (stem) query.set("stem", stem);

    navigate(`/student/tasks?${query.toString()}`);
  };

  useEffect(() => {
    if (genState !== "running") return;

    setGifIndex(0);
    const id = setInterval(() => {
      setGifIndex((i) => (i + 1) % GIFS.length);
    }, 2200);

    return () => clearInterval(id);
  }, [genState, GIFS]);

  useEffect(() => {
    if (!batchId) {
      setGenState("error");
      setGenErr(t("recommendations.errors.missingBatch"));
      return;
    }

    if (!stem) {
      setGenState("error");
      setGenErr(t("recommendations.errors.missingStem"));
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const loadNotesConclusion = async () => {
      setNotesErr("");
      setConclusion("");

      if (!notesUrl) return;

      try {
        const full = apiUrl(notesUrl);
        const notesJson = await fetchJson(full);
        if (cancelled) return;
        setConclusion(pickConclusion(notesJson));
      } catch (e) {
        if (cancelled) return;
        setNotesErr(String(e?.message || e));
        setConclusion("");
      }
    };

    const run = async () => {
      try {
        setGenErr("");
        setNotesErr("");

        const st0 = await getBatchStatus(batchId);
        if (cancelled) return;

        if (st0?.state === "done") {
          setGenState("done");
          setStageText("");
          await loadNotesConclusion();
          return;
        }

        if (st0?.state === "error") {
          setGenState("error");
          setGenErr(st0?.error || t("recommendations.errors.generationFailed"));
          return;
        }

        setGenState("running");

        for (let i = 0; i < 180; i++) {
          if (cancelled) return;

          setStageText(t("recommendations.running.stage"));

          const st = await getBatchStatus(batchId);
          if (cancelled) return;

          if (st?.state === "done") {
            setGenState("done");
            setStageText("");
            await loadNotesConclusion();
            return;
          }

          if (st?.state === "error") {
            setGenState("error");
            setGenErr(st?.error || t("recommendations.errors.generationFailed"));
            return;
          }

          await sleep(1000);
        }

        setGenState("error");
        setGenErr(t("recommendations.errors.timeout"));
      } catch (e) {
        if (cancelled) return;
        setGenState("error");
        setGenErr(String(e?.message || e));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [batchId, stem, notesUrl, t]);

  const openPdf = (rawUrl) => {
    const url = apiUrl(rawUrl);
    if (!url) return;
    window.open(encodeURI(url), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="reco-wrapper">
      <div className="reco-card">
        <div className="reco-header">
          <h2 className="reco-title">{t("recommendations.title")}</h2>
        </div>

        {genState === "error" && (
          <div className="reco-download-error" style={{ marginTop: 10 }}>
            {genErr}
          </div>
        )}

        {genState === "done" && (
          <div className="reco-content-grid">
            <div className="reco-info-card">
              <div className="reco-header reco-inner-header">
                <h3 className="reco-title reco-inner-title">{displayName}</h3>
              </div>

              <div className="reco-top-actions">
                <button
                  type="button"
                  className="reco-button reco-button--secondary"
                  onClick={() => openPdf(pdfUrl)}
                  disabled={!pdfUrl}
                  title={!pdfUrl ? t("recommendations.hints.pdfNotAvailable") : ""}
                >
                  {t("recommendations.actions.openPdf")}
                </button>
              </div>

              {conclusion && (
                <div className="reco-conclusion">
                  <div className="reco-conclusion-title">{t("recommendations.conclusion.title")}</div>
                  <div className="reco-conclusion-text">{conclusion}</div>
                </div>
              )}

              {!conclusion && notesErr && (
                <div className="reco-download-error" style={{ marginTop: 10 }}>
                  {t("recommendations.errors.notesNotReady")}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="reco-buttons-row reco-buttons-row--main">
          <button
            type="button"
            className="reco-button reco-button--primary reco-button--main"
            onClick={handleBackToTasks}
            disabled={!batchId || !stem}
            title={!stem ? t("recommendations.hints.loginFirst") : ""}
          >
            {t("recommendations.actions.startTasks")}
          </button>

          <button
            type="button"
            className="reco-button reco-button--secondary"
            onClick={handleOpenRating}
          >
            {t("recommendations.actions.rateSheet")}
          </button>

          <button
            type="button"
            className="reco-button reco-button--ghost"
            onClick={handleHomeClick}
          >
            {t("recommendations.actions.home")}
          </button>
        </div>

        {isRatingOpen && (
          <div className="reco-rating-card">
            <h3 className="reco-rating-title">{t("recommendations.rating.title")}</h3>

            <div className="reco-stars-row" aria-label={t("recommendations.rating.aria")}>
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    className={"reco-star" + (overallRating >= value ? " reco-star-active" : "")}
                    onClick={() => setOverallRating(value)}
                    aria-label={t("recommendations.rating.starAria", { value })}
                    title={t("recommendations.rating.starTitle", { value })}
                  >
                    ★
                  </button>
                );
              })}
            </div>

            <textarea
              className="reco-textarea"
              placeholder={t("recommendations.rating.placeholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-label={t("recommendations.rating.commentAria")}
            />

            <div className="reco-rating-actions">
              <button
                type="button"
                className="reco-button reco-button--primary"
                onClick={handleSubmitRating}
                disabled={overallRating === 0}
                title={overallRating === 0 ? t("recommendations.rating.needRatingTitle") : ""}
              >
                {t("recommendations.rating.submit")}
              </button>

              <button
                type="button"
                className="reco-button reco-button--ghost"
                onClick={() => setIsRatingOpen(false)}
              >
                {t("recommendations.rating.cancel")}
              </button>
            </div>
          </div>
        )}

        {ratingSubmitted && <div className="reco-success">{t("recommendations.rating.thanks")}</div>}
      </div>

      {genState === "running" && (
        <div className="students-processing-overlay" role="status" aria-live="polite">
          <div className="students-processing-card">
            <img
              className="students-processing-gif"
              src={GIFS[gifIndex]}
              alt={t("recommendations.running.alt")}
            />
            <div className="students-processing-title">{t("recommendations.running.title")}</div>
            <div className="students-processing-subtitle">
              {stageText || t("recommendations.running.pleaseWait")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsPage;