import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./TeacherStudents.css";

import proc1Light from "../assets/dragon_images/gif1_dragon.gif";
import proc2Light from "../assets/dragon_images/gif2_dragon.gif";
import proc3Light from "../assets/dragon_images/gif3_dragon.gif";
import proc4Light from "../assets/dragon_images/gif4_dragon.gif";
import proc5Light from "../assets/dragon_images/gif5_dragon.gif";

import proc1Dark from "../assets/dragon_images_dark/gif1_dragon.gif";
import proc2Dark from "../assets/dragon_images_dark/gif2_dragon.gif";
import proc3Dark from "../assets/dragon_images_dark/gif3_dragon.gif";
import proc4Dark from "../assets/dragon_images_dark/gif4_dragon.gif";
import proc5Dark from "../assets/dragon_images_dark/gif5_dragon.gif";

const TeacherStudents = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  const gifs = useMemo(() => {
    return theme === "dark"
      ? [proc1Dark, proc2Dark, proc3Dark, proc4Dark, proc5Dark]
      : [proc1Light, proc2Light, proc3Light, proc4Light, proc5Light];
  }, [theme]);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const batchId = params.get("batch");

  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [processing, setProcessing] = useState(false);
  const [stageText, setStageText] = useState("");
  const [gifIndex, setGifIndex] = useState(0);

  const abortRef = useRef(null);

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
    const run = async () => {
      try {
        setLoading(true);
        setErr("");

        const res = await fetch(`/api/batch/${encodeURIComponent(batchId)}/students`);
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        setStudents(data.students || []);
      } catch (e) {
        setErr(e?.message || t("teacherStudents.errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    if (batchId) run();
    else {
      setLoading(false);
      setErr(t("teacherStudents.errors.missingBatchId"));
    }
  }, [batchId, t]);

  useEffect(() => {
    if (!processing) return;

    setGifIndex(0);
    const id = setInterval(() => {
      setGifIndex((i) => (i + 1) % gifs.length);
    }, 2200);

    return () => clearInterval(id);
  }, [processing, gifs.length]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const normalized = search.trim().toLowerCase();
  const filtered = students.filter((s) =>
    (s.displayName || "").toLowerCase().includes(normalized)
  );

  const waitForFirstResult = async (bId) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    while (true) {
      if (controller.signal.aborted) throw new Error("Cancelled");

      const resResults = await fetch(`/api/batch/${encodeURIComponent(bId)}/results`, {
        signal: controller.signal,
      });

      if (resResults.ok) {
        const data = await resResults.json();
        const count = data.count ?? (data.results ? data.results.length : 0);
        if (count > 0) return;
      }

      const resStatus = await fetch(`/api/batch/${encodeURIComponent(bId)}/status`, {
        signal: controller.signal,
      });

      if (resStatus.ok) {
        const status = await resStatus.json();
        if (status.state === "error") {
          throw new Error(status.error || t("teacherStudents.errors.generationFailed"));
        }
      }

      setStageText(t("teacherStudents.stages.waitFirst"));
      await sleep(2000);
    }
  };

  const onGenerate = async () => {
    if (selectedIds.length === 0) {
      alert(t("teacherStudents.errors.selectAtLeastOne"));
      return;
    }

    try {
      setProcessing(true);
      setStageText(t("teacherStudents.stages.filtering"));

      const resFilter = await fetch(`/api/batch/${encodeURIComponent(batchId)}/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedIds }),
      });

      if (!resFilter.ok) {
        alert(await resFilter.text());
        setProcessing(false);
        setStageText("");
        return;
      }

      setStageText(t("teacherStudents.stages.starting"));

      const resGen = await fetch(`/api/batch/${encodeURIComponent(batchId)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: (i18n.resolvedLanguage || i18n.language || "sk").split("-")[0],
        }),
      });

      if (!(resGen.ok || resGen.status === 202)) {
        alert(await resGen.text());
        setProcessing(false);
        setStageText("");
        return;
      }

      await waitForFirstResult(batchId);

      navigate(`/teacher/results?batch=${encodeURIComponent(batchId)}`);
    } catch (e) {
      if (e?.message !== "Cancelled") {
        alert(e?.message || t("teacherStudents.errors.generationFailed"));
      }
      setProcessing(false);
      setStageText("");
    }
  };

  const disableUi = loading || !!err || processing;

  return (
    <div className="students-wrapper">
      <div className="students-card">
        <h2 className="students-title">{t("teacherStudents.title")}</h2>

        <div className="students-search-row">
          <div className="students-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("teacherStudents.searchPlaceholder")}
              disabled={processing}
              aria-label={t("teacherStudents.searchAria")}
            />
          </div>
        </div>

        {loading && <div className="students-empty">{t("teacherStudents.loading")}</div>}
        {!loading && err && <div className="students-empty">{err}</div>}

        {!loading && !err && (
          <div className="students-list-wrapper">
            <ul className="students-list">
              {filtered.length === 0 ? (
                <li className="students-empty">{t("teacherStudents.empty")}</li>
              ) : (
                filtered.map((s) => (
                  <li key={s.id} className="students-item">
                    <label>
                      <input
                        type="checkbox"
                        disabled={processing}
                        checked={selectedIds.includes(s.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((x) => x !== s.id)
                              : [...prev, s.id]
                          )
                        }
                      />
                      <span>{s.displayName}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        <div className="students-actions">
          <button
            type="button"
            className="results-back-button"
            onClick={() => navigate("/")}
            disabled={processing}
          >
            {t("teacherStudents.home")}
          </button>

          <button
            type="button"
            className="students-generate-btn"
            onClick={onGenerate}
            disabled={disableUi}
          >
            {t("teacherStudents.generate")}
          </button>
        </div>
      </div>

      {processing && (
        <div className="students-processing-overlay" role="status" aria-live="polite">
          <div className="students-processing-card">
            <img
              className="students-processing-gif"
              src={gifs[gifIndex]}
              alt={t("teacherStudents.processingAlt")}
            />
            <div className="students-processing-title">
              {t("teacherStudents.processingTitle")}
            </div>
            {stageText && (
              <div className="students-processing-subtitle">{stageText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherStudents;