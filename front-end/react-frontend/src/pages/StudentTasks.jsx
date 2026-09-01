import React, { useEffect, useMemo, useState } from "react";
import "./StudentTasks.css";
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

async function fetchJson(url) {
  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) throw new Error(text || `HTTP ${resp.status}`);
  return JSON.parse(text);
}

async function getBatchResults(batchId) {
  const resp = await fetch(`${API_BASE}/api/batch/${encodeURIComponent(batchId)}/results`);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Results HTTP ${resp.status}: ${text || "no body"}`);
  return JSON.parse(text);
}

function normalizeTasks(tasksJson) {
  if (!tasksJson) return [];

  let arr = Array.isArray(tasksJson) ? tasksJson : null;
  if (!arr && Array.isArray(tasksJson.data)) arr = tasksJson.data;
  if (!arr) return [];

  return arr
    .map((t, i) => {
      const id = t.id ?? t.taskId ?? i + 1;

      const question = t.Otazka ?? t["Otázka"] ?? t.question ?? t.text ?? "";
      const uloha = t.Uloha ?? t["Úloha"] ?? "";
      const answer = t.Odpoved ?? t["Odpoveď"] ?? t.answer ?? "";

      return {
        id,
        question: String(question || "").trim(),
        uloha: String(uloha || "").trim(),
        answer: String(answer || "").trim(),
      };
    })
    .filter((t) => t.question.length > 0);
}

const PASS_THRESHOLD = 8;

const StudentTasks = () => {
  const { t, i18n } = useTranslation();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  const MASCOT_GIFS = useMemo(() => {
    return theme === "dark"
      ? [gif1Dark, gif2Dark, gif3Dark, gif4Dark, gif5Dark]
      : [gif1Light, gif2Light, gif3Light, gif4Light, gif5Light];
  }, [theme]);

  const location = useLocation();
  const navigate = useNavigate();

  const lang = (i18n.resolvedLanguage || i18n.language || "sk").split("-")[0];

  const SURVEY_URL = useMemo(() => {
    const byLang = {
      sk: "https://forms.gle/HmmkJQ2E7SBaqxn6A",
      uk: "https://forms.gle/RChDaEvs2kp2rcSf8",
    };

    return byLang[lang] ?? byLang.sk;
  }, [lang]);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const courseId = params.get("course");
  const mode = params.get("mode");
  const batchId = params.get("batch");

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksErr, setTasksErr] = useState("");

  const [phase, setPhase] = useState("input"); // input | review | finished
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [showMascot, setShowMascot] = useState(true);

  const [studentAnswers, setStudentAnswers] = useState({});
  const [completedTaskIds, setCompletedTaskIds] = useState(() => new Set());

  const [toast] = useState({ open: false, text: "" });

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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setTasksLoading(true);
        setTasksErr("");

        if (!batchId) {
          setTasks([]);
          setTasksErr(t("studentTasks.errors.missingBatch"));
          return;
        }

        const res = await getBatchResults(batchId);
        const items = res.results || [];

        if (!items.length) {
          setTasks([]);
          setTasksErr(t("studentTasks.errors.noResults"));
          return;
        }

        let wantedStem = "";
        try {
          const saved = localStorage.getItem("studentAccess");
          if (saved) {
            const parsed = JSON.parse(saved);
            wantedStem = String(parsed?.stem || "").trim();
          }
        } catch {}

        const picked = wantedStem
          ? items.find((x) => (x.stem || x.id) === wantedStem) || items[0]
          : items[0];

        let taskUrl = apiUrl(picked?.task?.url);

        if (!taskUrl) {
          const stem = picked?.stem || picked?.id;
          if (stem) {
            taskUrl = apiUrl(
              `/api/batch/${batchId}/results_tasks/${encodeURIComponent(stem)}.json`
            );
          }
        }

        const rawTasksJson = await fetchJson(taskUrl);
        const normalized = normalizeTasks(rawTasksJson);

        if (cancelled) return;

        setTasks(normalized);
        setCompletedTaskIds(new Set());
        setStudentAnswers({});
        setCurrentIndex(0);
        setPhase("input");
        setRating(0);
      } catch (e) {
        if (cancelled) return;
        setTasks([]);
        setTasksErr(String(e?.message || e));
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [batchId, t]);

  const activeTasks = useMemo(
    () => tasks.filter((tt) => !completedTaskIds.has(tt.id)),
    [tasks, completedTaskIds]
  );

  const totalActive = activeTasks.length;
  const currentTask = activeTasks[currentIndex];
  const allDone = totalActive === 0 && tasks.length > 0;

  const pairIndex = Math.floor(currentIndex / 2);
  const mascotGif = MASCOT_GIFS[pairIndex % MASCOT_GIFS.length];

  const myAnswer = useMemo(() => {
    if (!currentTask) return "";
    return (studentAnswers[currentTask.id] || "").trim();
  }, [studentAnswers, currentTask]);

  const goToQuestion = (index) => {
    if (index < 0 || index >= totalActive) return;
    setCurrentIndex(index);
    setPhase("input");
    setRating(0);
  };

  const goToNextQuestion = () => {
    if (totalActive === 0) return;
    const next = (currentIndex + 1) % totalActive;
    goToQuestion(next);
  };

  const confirmMyAnswer = () => {
    if (!myAnswer) return;
    setPhase("review");
  };

  const handleRecommendationClick = () => {
    const query = new URLSearchParams();
    if (courseId) query.set("course", courseId);
    if (mode) query.set("mode", mode);
    if (batchId) query.set("batch", batchId);
    navigate(`/recommendations?${query.toString()}`);
  };

  const restartAll = () => {
    setCompletedTaskIds(new Set());
    setStudentAnswers({});
    setCurrentIndex(0);
    setPhase("input");
    setRating(0);
  };

  const submitSelfRating = () => {
    if (!currentTask) return;

    console.log(
      "Task:",
      currentTask.id,
      "My answer:",
      studentAnswers[currentTask.id] || "",
      "Answer:",
      currentTask.answer,
      "Rating:",
      rating,
      "Course:",
      courseId,
      "Batch:",
      batchId,
      "Mode:",
      mode
    );

    if (rating >= PASS_THRESHOLD) {
      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(currentTask.id);
        return next;
      });

      setPhase("input");
      setRating(0);

      setCurrentIndex((prevIndex) => {
        const nextLen = totalActive - 1;
        if (nextLen <= 0) return 0;
        return Math.min(prevIndex, nextLen - 1);
      });

      return;
    }

    setPhase("finished");
  };

  if (tasksLoading) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-card">
          <p className="tasks-text" style={{ opacity: 0.85 }}>
            {t("studentTasks.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (tasksErr) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-card">
          <div className="tasks-toast" style={{ display: "block" }}>
            {tasksErr}
          </div>

          <div className="tasks-buttons-row" style={{ marginTop: 12 }}>
            <button
              className="tasks-primary-button"
              onClick={handleRecommendationClick}
              type="button"
            >
              {t("studentTasks.backToRecommendations")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-card">
          <p className="tasks-text">{t("studentTasks.empty")}</p>
          <div className="tasks-buttons-row" style={{ marginTop: 12 }}>
            <button
              className="tasks-primary-button"
              onClick={handleRecommendationClick}
              type="button"
            >
              {t("studentTasks.backToRecommendations")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-card">
          {toast.open && <div className="tasks-toast">{toast.text}</div>}

          <div className="tasks-header">
            <div className="tasks-label">{t("studentTasks.done.title")}</div>
          </div>

          <p className="tasks-text">{t("studentTasks.done.text")}</p>

          <div className="tasks-buttons-row" style={{ marginTop: 16 }}>
            <a
              href={SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tasks-primary-button"
            >
              {t("studentTasks.done.survey")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!currentTask) return null;

  return (
    <div className="tasks-wrapper">
      <div className="tasks-card">
        {toast.open && <div className="tasks-toast">{toast.text}</div>}

        <div className="tasks-header">
          <div className="tasks-label">
            {t("studentTasks.taskCounter", { id: currentTask.id, total: totalActive })}
          </div>
        </div>

        <div className={"tasks-layout" + (showMascot ? "" : " tasks-layout--wide")}>
          <div className="tasks-main">
            <p className="tasks-text">{currentTask.question}</p>

            {currentTask.uloha && (
              <p className="tasks-text" style={{ opacity: 0.9, marginTop: 6 }}>
                {currentTask.uloha}
              </p>
            )}

            <p className="tasks-answer-label">{t("studentTasks.labels.myAnswer")}</p>
            <textarea
              className="tasks-my-answer"
              placeholder={t("studentTasks.placeholders.myAnswer")}
              value={studentAnswers[currentTask.id] || ""}
              onChange={(e) =>
                setStudentAnswers((prev) => ({
                  ...prev,
                  [currentTask.id]: e.target.value,
                }))
              }
              rows={4}
              disabled={phase !== "input"}
              aria-label={t("studentTasks.aria.myAnswer")}
            />

            {phase !== "input" && (
              <>
                <p className="tasks-answer-label">{t("studentTasks.labels.answer")}</p>
                <p className="tasks-text">{currentTask.answer}</p>

                <div className="tasks-rating-block">
                  <h3 className="tasks-rating-title">{t("studentTasks.rating.title")}</h3>

                  <div className="tasks-stars-wrapper">
                    <div
                      className="tasks-stars-row tasks-stars-row--inline"
                      aria-label={t("studentTasks.rating.aria")}
                    >
                      {Array.from({ length: 10 }).map((_, i) => {
                        const value = i + 1;
                        return (
                          <button
                            key={value}
                            className={
                              "tasks-star" + (rating >= value ? " tasks-star-active" : "")
                            }
                            onClick={() => setRating(value)}
                            type="button"
                            aria-label={t("studentTasks.rating.starAria", { value })}
                            title={t("studentTasks.rating.starTitle", { value })}
                          >
                            ★
                          </button>
                        );
                      })}
                    </div>

                    {phase === "review" && rating >= PASS_THRESHOLD && (
                      <div className="tasks-rating-hint">{t("studentTasks.rating.hint")}</div>
                    )}

                    <div className="tasks-stars-counter">
                      {t("studentTasks.rating.counter", { rating: rating || 0 })}
                    </div>
                  </div>

                  {phase === "review" && (
                    <button
                      className="tasks-rating-submit"
                      onClick={submitSelfRating}
                      disabled={rating === 0}
                      type="button"
                      title={rating === 0 ? t("studentTasks.rating.needRatingTitle") : ""}
                    >
                      {t("studentTasks.rating.submit")}
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="tasks-buttons-row">
              {phase === "input" && (
                <button
                  className="tasks-primary-button"
                  onClick={confirmMyAnswer}
                  disabled={!myAnswer}
                  title={!myAnswer ? t("studentTasks.errors.writeAnswerFirst") : ""}
                  type="button"
                >
                  {t("studentTasks.actions.submitAnswer")}
                </button>
              )}

              {phase === "finished" && (
                <>
                  <button className="tasks-primary-button" onClick={goToNextQuestion} type="button">
                    {t("studentTasks.actions.nextQuestion")}
                  </button>
{/* 
                  <button
                    className="tasks-primary-button"
                    onClick={handleRecommendationClick}
                    type="button"
                  >
                    {t("studentTasks.actions.viewRecommendations")}
                  </button> */}
                </>
              )}
            </div>
          </div>

          <div className="tasks-side">
            <div className="tasks-checkbox-row">
              <input
                type="checkbox"
                className="tasks-toggle"
                checked={showMascot}
                onChange={() => setShowMascot(!showMascot)}
                aria-label={t("studentTasks.aria.toggleMascot")}
                title={t("studentTasks.aria.toggleMascot")}
              />
            </div>

            <div className={"tasks-side-row" + (showMascot ? "" : " tasks-side-row--no-mascot")}>
              <div className="tasks-progress">
                <button
                  className="tasks-progress-arrow"
                  onClick={() => goToQuestion((currentIndex + 1) % totalActive)}
                  type="button"
                  aria-label={t("studentTasks.aria.prev")}
                  title={t("studentTasks.aria.prev")}
                >
                  ↑
                </button>

                <div className="tasks-progress-number-single">{currentTask.id}</div>

                <button
                  className="tasks-progress-arrow"
                  onClick={() => goToQuestion((currentIndex - 1 + totalActive) % totalActive)}
                  type="button"
                  aria-label={t("studentTasks.aria.next")}
                  title={t("studentTasks.aria.next")}
                >
                  ↓
                </button>
              </div>

              {showMascot && (
                <div className="tasks-mascot fade-in">
                  <div className="tasks-mascot-circle">
                    <img
                      src={mascotGif}
                      alt={t("studentTasks.mascotAlt")}
                      className="tasks-mascot-gif"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {false && (
          <button className="tasks-primary-button" onClick={restartAll} type="button">
            {t("studentTasks.done.restart")}
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentTasks;