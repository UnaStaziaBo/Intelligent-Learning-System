import React, { useEffect, useMemo, useState } from "react";
import "./StudentTasks.css";
import { useLocation, useNavigate } from "react-router-dom";

import StudentWalkthrough from "../components/StudentWalkthrough";

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

const TEST_TASKS = [
  {
    id: 1,
    type: "choice",
    question:
      "Nech funkcia f má deriváciu na otvorenom intervale I. Funkcia f je klesajúca na I, ak pre každé x ∈ I platí",
    options: ["f′(x) < 0", "f′(x) > 0", "f′(x) ≤ 0", "f′′(x) > 0"],
    correctIndex: 2,
  },
  {
    id: 2,
    type: "choice",
    question:
      "Funkcia f : I → R sa nazýva konkávna na intervale I, ak pre každú trojicu bodov x, x1, x2 ∈ I takú, že x1 < x < x2",
    options: [
      "je bod [x, f (x)] nad priamkou určenou bodmi [x1, f (x1)], [x2, f (x2)] alebo leží na tejto priamke.",
      "je bod [x, f (x)] pod priamkou určenou bodmi [x1, f (x1)], [x2, f (x2)] alebo leží na tejto priamke.",
      "je bod [x1, f (x1)] nad priamkou určenou bodmi [x, f (x)], [x2, f (x2)] alebo leží na tejto priamke.",
      "je bod [x2, f (x2)] pod priamkou určenou bodmi [x1, f (x1)], [x, f (x)] alebo leží na tejto priamke.",
    ],
    correctIndex: 0,
  },
  {
    id: 3,
    type: "choice",
    question:
      "Nech existuje f′(x0). Ak funkcia f má v bode x0 lokálny extrém, tak",
    options: ["f′(x0) > 0", "f′(x0) < 0", "f′(x0) = 0", "f′′(x0) = 0"],
    correctIndex: 2,
  },
  {
    id: 4,
    type: "choice",
    question: "Ak k danej matici A existuje inverzná matica A⁻¹, potom platí",
    options: [
      "A⁻¹ = adj A",
      "A⁻¹ = |A| · adj A",
      "A⁻¹ = (1 / |A|) · adj A",
      "A⁻¹ = (1 / |A|) · A",
    ],
    correctIndex: 2,
  },
  {
    id: 5,
    type: "choice",
    question: "Sústava lineárnych rovníc A x⃗ = b⃗ má nekonečne veľa riešení, ak",
    options: [
      "h(A) = h(A′) = n (počet neznámych)",
      "h(A) = h(A′) < n (počet neznámych)",
      "h(A) = h(A′) ≥ n (počet neznámych)",
      "h(A) = h(A′)",
    ],
    correctIndex: 1,
  },
  {
    id: 6,
    type: "choice",
    question:
      "Cramerovým pravidlom môžeme riešiť sústavu lineárnych rovníc A x⃗ = b⃗, ak",
    options: ["|A| = 0", "|A| ≠ 0", "matica A je nulová", "sústava má nekonečne veľa riešení"],
    correctIndex: 1,
  },
];

async function submitToCsv(batchId, payload) {
  const resp = await fetch(`/api/batch/${batchId}/test-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text || "no body"}`);
}

async function startGeneration(batchId) {
  const resp = await fetch(`/api/batch/${batchId}/generate`, { method: "POST" });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Generate failed HTTP ${resp.status}: ${text || "no body"}`);
}

async function getBatchStatus(batchId) {
  const resp = await fetch(`/api/batch/${batchId}/status`, { method: "GET" });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Status failed HTTP ${resp.status}: ${text || "no body"}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Status invalid JSON: ${text}`);
  }
}

const StudentTest = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  const MASCOT_GIFS = useMemo(() => {
    return theme === "dark"
      ? [gif1Dark, gif2Dark, gif3Dark, gif4Dark, gif5Dark]
      : [gif1Light, gif2Light, gif3Light, gif4Light, gif5Light];
  }, [theme]);

  const navigate = useNavigate();
  const location = useLocation();

  const batchId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("batch") || "";
  }, [location.search]);

  const [stage, setStage] = useState("walkthrough");

  const total = TEST_TASKS.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMascot, setShowMascot] = useState(true);

  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const [startedAt] = useState(() => Date.now());

  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const [genState, setGenState] = useState("idle"); // idle | running | done | error
  const [genErr, setGenErr] = useState("");
  const [gifIndex, setGifIndex] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  const currentTask = TEST_TASKS[currentIndex];

  const pairIndex = Math.floor(currentIndex / 2);
  const mascotGif = MASCOT_GIFS[pairIndex % MASCOT_GIFS.length];
  const MAX_WAIT_MS = 20 * 60 * 1000;
  const POLL_MS = 2000;

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

  const pickedIndex = useMemo(() => {
    if (!currentTask) return null;
    const v = answers[currentTask.id];
    return v === undefined ? null : v;
  }, [answers, currentTask]);

  const goToQuestion = (index) => {
    if (index < 0 || index >= total) return;
    setCurrentIndex(index);
  };

  const next = () => {
    if (!currentTask) return;
    if (pickedIndex === null) return;

    const isCorrect = pickedIndex === currentTask.correctIndex;
    if (isCorrect) setScore((s) => s + 1);

    const isLast = currentIndex === total - 1;
    if (isLast) setFinished(true);
    else setCurrentIndex((i) => i + 1);
  };

  const buildQuestionsPayload = () => {
    return TEST_TASKS.map((t) => {
      const picked = answers[t.id];
      const responseText = picked === undefined ? "" : t.options?.[picked] ?? "";
      const rightText = t.options?.[t.correctIndex] ?? "";
      return {
        question: t.question,
        options: t.options || [],
        response: responseText,
        rightAnswer: rightText,
      };
    });
  };

  const saveResults = async () => {
    if (!batchId) {
      setSaveErr("Chýba batchId v URL (napr. ?batch=xxxx).");
      return;
    }

    try {
      setSaveErr("");

      const completedAt = Date.now();
      const questions = buildQuestionsPayload();

      const payload = {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        idNumber: "",
        email: "",
        status: "Completed",
        started: Math.floor(startedAt / 1000),
        completed: Math.floor(completedAt / 1000),
        grade: score,
        questions,
      };

      await submitToCsv(batchId, payload);
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setSaveErr(String(e?.message || e));
    }
  };

  useEffect(() => {
    if (!finished) return;
    if (saved) return;
    saveResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  useEffect(() => {
    if (genState !== "running") return;

    setGifIndex(0);
    const id = setInterval(() => {
      setGifIndex((i) => (i + 1) % MASCOT_GIFS.length);
    }, 2200);

    return () => clearInterval(id);
  }, [genState, MASCOT_GIFS]);

  const runGeneration = async () => {
    if (!batchId) {
      setGenState("error");
      setGenErr("Chýba batchId v URL.");
      return;
    }

    try {
      setGenErr("");
      setGenState("running");

      await startGeneration(batchId);

      const start = Date.now();

      while (Date.now() - start < MAX_WAIT_MS) {
        const st = await getBatchStatus(batchId);

        if (st?.state === "done") {
          setGenState("done");
          navigate(`/recommendations?batch=${encodeURIComponent(batchId)}`);
          return;
        }

        if (st?.state === "error") {
          setGenState("error");
          setGenErr(st?.error || "Generation failed");
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      setGenState("error");
      setGenErr("Generation timeout (status did not become done).");
    } catch (e) {
      setGenState("error");
      setGenErr(String(e?.message || e));
    }
  };

  if (TEST_TASKS.length === 0) {
    return (
      <div className="tasks-wrapper">
        <div className="tasks-card">
          <p className="tasks-text">
            Zatiaľ tu nie je žiadny test. Pridaj položky do <code>TEST_TASKS</code>.
          </p>
          <div className="tasks-buttons-row">
            <button className="tasks-primary-button" onClick={() => navigate("/")} type="button">
              Späť na hlavnú stránku
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const percent = Math.round((score / total) * 100);

    const reviewRows = TEST_TASKS.map((t) => {
      const picked = answers[t.id];
      const chosen = picked === undefined ? "" : t.options?.[picked] ?? "";
      const right = t.options?.[t.correctIndex] ?? "";
      const ok = picked === t.correctIndex;
      return { id: t.id, question: t.question, chosen, right, ok };
    });

    return (
      <div className="tasks-wrapper">
        <div className="tasks-card">
          <div className="tasks-header">
            <div className="tasks-label">Výsledok</div>
          </div>

          <p className="tasks-text">
            Správne: {score} / {total} ({percent}%)
          </p>

          {saveErr && (
            <p className="tasks-text" style={{ opacity: 0.75 }}>
              Chyba pri ukladaní: {saveErr}
            </p>
          )}

          {!saved && !saveErr && (
            <p className="tasks-text" style={{ opacity: 0.75 }}>
              Ukladám výsledok…
            </p>
          )}

          {saved && (
            <p className="tasks-text" style={{ opacity: 0.75 }}>
              Výsledok uložený
            </p>
          )}

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {reviewRows.map((r) => (
              <div key={r.id} className="tasks-card" style={{ padding: 14 }}>
                <div className="tasks-header" style={{ marginBottom: 10 }}>
                  <div
                    className="tasks-label"
                    style={{ display: "flex", justifyContent: "space-between", width: "100%" }}
                  >
                    <span>Otázka {r.id}</span>
                    <span style={{ opacity: 0.85 }}>{r.ok ? "Správne" : "Nesprávne"}</span>
                  </div>
                </div>

                <p className="tasks-text" style={{ marginBottom: 10 }}>
                  {r.question}
                </p>

                <p className="tasks-answer-label">Vaša odpoveď</p>
                <div
                  className="tasks-primary-button"
                  style={{
                    textAlign: "left",
                    cursor: "default",
                    opacity: 0.95,
                    background: r.ok ? "rgba(174, 197, 157, 0.18)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  {r.chosen || "—"}
                </div>

                <p className="tasks-answer-label" style={{ marginTop: 10 }}>
                  Správna odpoveď
                </p>
                <div
                  className="tasks-primary-button"
                  style={{
                    textAlign: "left",
                    cursor: "default",
                    opacity: 0.95,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  {r.right || "—"}
                </div>
              </div>
            ))}
          </div>

          {genState === "error" && genErr && (
            <p className="tasks-text" style={{ opacity: 0.75, marginTop: 10 }}>
              Chyba generovania: {genErr}
            </p>
          )}

          <div className="tasks-buttons-row" style={{ marginTop: 14 }}>
            <button
              className="tasks-primary-button"
              type="button"
              onClick={runGeneration}
              disabled={!saved || genState === "running" || !batchId}
              style={{
                opacity: !saved || genState === "running" || !batchId ? 0.6 : 1,
                cursor: !saved || genState === "running" || !batchId ? "not-allowed" : "pointer",
              }}
            >
              Generovať materiály
            </button>
          </div>
        </div>

        {genState === "running" && (
          <div className="students-processing-overlay" role="status" aria-live="polite">
            <div className="students-processing-card">
              <img className="students-processing-gif" src={MASCOT_GIFS[gifIndex]} alt="Processing" />
              <div className="students-processing-title">Spracovávame materiály...</div>
              <div className="students-processing-subtitle">
                Prosím počkajte, generujeme odporúčania
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!currentTask) return null;

  return (
    <div className="tasks-wrapper">
      {stage === "walkthrough" && <StudentWalkthrough onClose={() => setStage("name")} />}

      {stage === "name" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div className="tasks-card" style={{ maxWidth: 520, width: "100%" }}>
            <div className="tasks-header">
              <div className="tasks-label">Pred testom</div>
            </div>

            <p className="tasks-text" style={{ opacity: 0.85 }}>
              Zadajte meno a priezvisko
            </p>

            <p className="tasks-answer-label">Meno</p>
            <input
              className="tasks-my-answer"
              style={{ height: 44 }}
              placeholder="Meno..."
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <p className="tasks-answer-label" style={{ marginTop: 12 }}>
              Priezvisko
            </p>
            <input
              className="tasks-my-answer"
              style={{ height: 44 }}
              placeholder="Priezvisko..."
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <div className="tasks-buttons-row" style={{ marginTop: 16 }}>
              <button
                className="tasks-primary-button"
                type="button"
                onClick={() => setStage("test")}
                disabled={!canContinue}
                style={{
                  opacity: canContinue ? 1 : 0.6,
                  cursor: canContinue ? "pointer" : "not-allowed",
                }}
              >
                Pokračovať
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tasks-card" style={{ opacity: stage === "test" ? 1 : 0.25 }}>
        <div className="tasks-header">
          <div className="tasks-label">
            Moodle test: otázka {currentTask.id} / {TEST_TASKS.length}
          </div>
        </div>

        <div className={"tasks-layout" + (showMascot ? "" : " tasks-layout--wide")}>
          <div className="tasks-main">
            <p className="tasks-text">{currentTask.question}</p>

            <p className="tasks-answer-label">Vyberte odpoveď</p>
            <div style={{ display: "grid", gap: "10px" }}>
              {(currentTask.options || []).map((opt, i) => {
                const active = answers[currentTask.id] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className="tasks-primary-button"
                    disabled={stage !== "test"}
                    style={{
                      textAlign: "left",
                      background: active ? "rgba(174, 197, 157, 0.18)" : undefined,
                      opacity: stage === "test" ? 1 : 0.7,
                      cursor: stage === "test" ? "pointer" : "not-allowed",
                    }}
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentTask.id]: i }))}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="tasks-buttons-row">
              <button
                className="tasks-primary-button"
                onClick={next}
                disabled={stage !== "test" || pickedIndex === null}
                type="button"
                style={{
                  opacity: stage !== "test" || pickedIndex === null ? 0.6 : 1,
                  cursor: stage !== "test" || pickedIndex === null ? "not-allowed" : "pointer",
                }}
              >
                Ďalej
              </button>
            </div>
          </div>

          <div className="tasks-side">
            <div className="tasks-checkbox-row">
              <input
                type="checkbox"
                className="tasks-toggle"
                checked={showMascot}
                disabled={stage !== "test"}
                onChange={() => setShowMascot(!showMascot)}
              />
            </div>

            <div className={"tasks-side-row" + (showMascot ? "" : " tasks-side-row--no-mascot")}>
              <div className="tasks-progress">
                <button
                  className="tasks-progress-arrow"
                  onClick={() => goToQuestion((currentIndex + 1) % total)}
                  type="button"
                  disabled={stage !== "test"}
                >
                  ↑
                </button>

                <div className="tasks-progress-number-single">{currentTask.id}</div>

                <button
                  className="tasks-progress-arrow"
                  onClick={() => goToQuestion((currentIndex - 1 + total) % total)}
                  type="button"
                  disabled={stage !== "test"}
                >
                  ↓
                </button>
              </div>

              {showMascot && (
                <div className="tasks-mascot fade-in">
                  <div className="tasks-mascot-circle">
                    <img src={mascotGif} alt="Motivačný pomocník" className="tasks-mascot-gif" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTest;