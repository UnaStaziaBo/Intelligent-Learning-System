import React, { useEffect, useMemo, useRef, useState } from "react";
import "./TeacherResults.css";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TeacherResultsAccessWalkthrough from "../components/TeacherResultsAccessWalkthrough";

const TeacherResults = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const batchId = params.get("batch");

  const [query, setQuery] = useState("");
  const [demoStudent, setDemoStudent] = useState(null);
  const [demoTitle, setDemoTitle] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [demoData, setDemoData] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoKind, setDemoKind] = useState("notes"); // "notes" | "task"

  const [status, setStatus] = useState("idle");
  const [statusErr, setStatusErr] = useState("");

  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinErr, setPinErr] = useState("");

  const [guideStep, setGuideStep] = useState("generate"); // "generate" | "save" | "copy" | "done"
  const [showGuide, setShowGuide] = useState(true);

  const demoRef = useRef(null);

  const lang = (i18n.resolvedLanguage || i18n.language || "sk").split("-")[0];

  const surveyLink = useMemo(() => {
    const byLang = {
      sk: "",
      uk: "",
      en: "",
    };
    return byLang[lang] ?? byLang.sk;
  }, [lang]);

  const validatePin = (p) => {
    const v = (p || "").toString().trim();
    if (v.length < 4 || v.length > 12 || /\s/.test(v)) {
      return { ok: false, pin: v, error: t("teacherResults.pin.validationError") };
    }
    return { ok: true, pin: v, error: "" };
  };

  const loadPin = async () => {
    if (!batchId) return;

    try {
      setPinErr("");
      setPinLoading(true);

      const r = await fetch(`/api/batch/${encodeURIComponent(batchId)}/pin`);
      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.error || t("teacherResults.pin.loadFailed"));

      const p = (j?.pin || "").toString();
      setPin(p);
      setPinInput(p);

      if (validatePin(p).ok) {
        setGuideStep("copy");
      } else {
        setGuideStep("generate");
      }

      setShowGuide(true);
    } catch (e) {
      setPinErr(e?.message || t("teacherResults.pin.loadFailed"));
    } finally {
      setPinLoading(false);
    }
  };

  const savePinManual = async () => {
    if (!batchId) return;

    const v = validatePin(pinInput);
    if (!v.ok) {
      setPinErr(v.error);
      return;
    }

    try {
      setPinErr("");
      setPinLoading(true);

      const r = await fetch(`/api/batch/${encodeURIComponent(batchId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: v.pin }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || t("teacherResults.pin.saveFailed"));

      const saved = (j?.pin || v.pin).toString();
      setPin(saved);
      setPinInput(saved);
      setGuideStep("copy");
    } catch (e) {
      setPinErr(e?.message || t("teacherResults.pin.saveFailed"));
    } finally {
      setPinLoading(false);
    }
  };

  const generatePin = async () => {
    if (!batchId) return;

    try {
      setPinErr("");
      setPinLoading(true);

      const r = await fetch(`/api/batch/${encodeURIComponent(batchId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || t("teacherResults.pin.generateFailed"));

      const newPin = (j?.pin || "").toString();
      setPin(newPin);
      setPinInput(newPin);
      setGuideStep("save");
    } catch (e) {
      setPinErr(e?.message || t("teacherResults.pin.generateFailed"));
    } finally {
      setPinLoading(false);
    }
  };

  const copyPinAndLink = async () => {
    if (!batchId) return;

    const p = (pinInput || pin || "").toString().trim();
    const v = validatePin(p);
    if (!v.ok) {
      setPinErr(v.error);
      return;
    }

    const link = `${window.location.origin}/student?batch=${batchId}`;
    const text = `${t("teacherResults.access.copyText.link")}: ${link}\n${t(
      "teacherResults.access.copyText.pin"
    )}: ${v.pin}`;

    try {
      setPinErr("");
      await navigator.clipboard.writeText(text);
      setGuideStep("done");
      setTimeout(() => setShowGuide(false), 500);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!batchId) {
      setErr(t("teacherResults.errors.missingBatchId"));
      setLoading(false);
      return;
    }

    loadPin();

    let alive = true;

    const fetchAll = async () => {
      try {
        const res = await fetch(`/api/batch/${encodeURIComponent(batchId)}/results`);
        if (res.ok) {
          const data = await res.json();
          if (alive) setItems(data.results || []);
        }

        const stRes = await fetch(`/api/batch/${encodeURIComponent(batchId)}/status`);
        if (stRes.ok) {
          const st = await stRes.json();
          if (!alive) return;
          setStatus(st.state || "idle");
          setStatusErr(st.error || "");
        }

        if (alive) setErr("");
      } catch (e) {
        if (alive) setErr(e?.message || t("teacherResults.errors.loadFailed"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 2500);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [batchId, t]);

  const filtered = items.filter((x) =>
    (x.displayName || "").toLowerCase().includes(query.trim().toLowerCase())
  );

  const openDemo = async (item, kind = "notes") => {
    setDemoStudent(item);
    setDemoKind(kind);
    setDemoLoading(true);
    setDemoData(null);

    const title =
      kind === "notes"
        ? t("teacherResults.demo.titleNotes", { name: item.displayName })
        : t("teacherResults.demo.titleTasks", { name: item.displayName });

    setDemoTitle(title);

    setTimeout(() => demoRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const meta = kind === "notes" ? item.notes : item.task;

      if (!meta?.exists) {
        setDemoData({ message: t("teacherResults.demo.noData", { kind }) });
        return;
      }

      const res = await fetch(meta.url);
      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      setDemoData(json);
    } catch (e) {
      setDemoData({ error: e?.message || t("teacherResults.demo.loadFailed") });
    } finally {
      setDemoLoading(false);
    }
  };

  const getTasksList = (json) => {
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows
      .map((r, idx) => ({
        idx: idx + 1,
        question: (r?.Otazka ?? "").trim(),
        task: (r?.["Úloha"] ?? r?.Uloha ?? "").trim(),
        answer: (r?.Odpoved ?? "").trim(),
      }))
      .filter((x) => x.question || x.task || x.answer);
  };

  const getNotesModel = (json) => {
    if (!json || typeof json !== "object") return null;

    const title = (json.title ?? "").toString().trim();
    const meta = json.meta ?? {};

    const date = (meta.date ?? "").toString().trim();
    const sources = Array.isArray(meta.sources) ? meta.sources.filter(Boolean) : [];

    const sectionsRaw = Array.isArray(json.sections) ? json.sections : [];
    const sections = sectionsRaw.map((s, idx) => {
      const heading = (s?.heading ?? t("teacherResults.notes.sectionFallback", { n: idx + 1 }))
        .toString()
        .trim();

      const notes = Array.isArray(s?.notes) ? s.notes.filter(Boolean) : [];
      const bullets = Array.isArray(s?.bullets) ? s.bullets.filter(Boolean) : [];

      const termsRaw = Array.isArray(s?.terms) ? s.terms : [];
      const terms = termsRaw
        .map((t2) => ({
          term: (t2?.term ?? "").toString().trim(),
          definition: (t2?.definition ?? "").toString().trim(),
        }))
        .filter((t2) => t2.term || t2.definition);

      const callout = (s?.callout ?? "").toString().trim();
      const recommendations = (s?.recommendations ?? "").toString().trim();

      return { idx: idx + 1, heading, notes, bullets, terms, callout, recommendations };
    });

    const conclusion = (json.conclusion ?? "").toString().trim();

    return { title, date, sources, sections, conclusion };
  };

  const studentLink = batchId ? `${window.location.origin}/student?batch=${batchId}` : "";
  const activePin = (pinInput || pin || "").toString().trim();
  const isPinValid = validatePin(activePin).ok;

  return (
    <div className="results-wrapper">
      <div className="results-panel">
        <TeacherResultsAccessWalkthrough
          open={!!batchId && showGuide}
          step={guideStep}
          onClose={() => setShowGuide(false)}
          onGenerate={generatePin}
          onSave={savePinManual}
          onCopy={copyPinAndLink}
          pinInput={pinInput}
          pinLoading={pinLoading}
          canSave={!!pinInput.trim()}
          canCopy={!batchId ? false : isPinValid}
        />

        <h2 className="results-title">{t("teacherResults.title")}</h2>

        {batchId && (
          <div className="results-banner" style={{ marginTop: 10 }}>
            <div className="results-access-card">
              <div className="results-access-row">
                <div className="results-access-col">
                  <div className="results-access-label">{t("teacherResults.access.pinLabel")}</div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      className="results-access-input"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder={t("teacherResults.access.pinPlaceholder")}
                      disabled={pinLoading}
                      style={{ flex: "1 1 180px" }}
                      aria-label={t("teacherResults.access.pinAria")}
                    />

                    <button
                      className="results-back-button"
                      type="button"
                      onClick={generatePin}
                      disabled={pinLoading}
                      title={t("teacherResults.access.generatePinTitle")}
                    >
                      {t("teacherResults.access.generatePin")}
                    </button>

                    <button
                      className="results-back-button"
                      type="button"
                      onClick={savePinManual}
                      disabled={pinLoading || !pinInput.trim()}
                      title={t("teacherResults.access.savePinTitle")}
                    >
                      {t("teacherResults.access.savePin")}
                    </button>
                  </div>

                  <div className="results-access-hint">{t("teacherResults.access.pinHint")}</div>
                </div>

                <div className="results-access-col">
                  <div className="results-access-label">{t("teacherResults.access.linkLabel")}</div>
                  <div className="results-access-link">{studentLink}</div>
                  <div className="results-access-hint">{t("teacherResults.access.linkHint")}</div>
                </div>
              </div>

              <div className="results-access-actions">
                <button
                  className="results-primary-button"
                  type="button"
                  onClick={copyPinAndLink}
                  disabled={!batchId || !isPinValid}
                  title={!activePin ? t("teacherResults.access.needPinTitle") : ""}
                >
                  {t("teacherResults.access.copyAccess")}
                </button>
              </div>

              {pinErr && <div style={{ color: "#b00020", marginTop: 8 }}>{pinErr}</div>}
            </div>
          </div>
        )}

        {status === "running" && (
          <div className="results-banner">{t("teacherResults.status.running")}</div>
        )}
        {status === "done" && (
          <div className="results-banner results-banner-done">{t("teacherResults.status.done")}</div>
        )}
        {status === "error" && (
          <div className="results-banner results-banner-error">
            {t("teacherResults.status.errorPrefix")} {statusErr || t("teacherResults.status.unknown")}
          </div>
        )}

        {demoStudent && (
          <div className="results-demo accent" ref={demoRef}>
            <h3 className="results-demo-title">
              {demoTitle || t("teacherResults.demo.fallbackTitle", { name: demoStudent.displayName })}
            </h3>

            <div className="results-demo-body">
              {demoLoading && <div className="students-empty">{t("teacherResults.demo.loading")}</div>}

              {!demoLoading && demoData && (
                <>
                  {demoKind === "task" && (
                    <div className="tasks-view">
                      {getTasksList(demoData).length === 0 ? (
                        <div className="students-empty">{t("teacherResults.tasks.empty")}</div>
                      ) : (
                        getTasksList(demoData).map((tt) => (
                          <div key={tt.idx} className="task-card">
                            <div className="task-header">
                              {t("teacherResults.tasks.taskNo", { n: tt.idx })}
                            </div>

                            {tt.question && (
                              <div className="task-block">
                                <div className="task-label">{t("teacherResults.tasks.labels.question")}</div>
                                <div className="task-text">{tt.question}</div>
                              </div>
                            )}

                            {tt.task && (
                              <div className="task-block">
                                <div className="task-label">{t("teacherResults.tasks.labels.task")}</div>
                                <div className="task-text">{tt.task}</div>
                              </div>
                            )}

                            {tt.answer && (
                              <div className="task-block">
                                <div className="task-label">{t("teacherResults.tasks.labels.answer")}</div>
                                <div className="task-text task-answer">{tt.answer}</div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {demoKind === "notes" &&
                    (() => {
                      const m = getNotesModel(demoData);
                      if (!m) return <div className="students-empty">{t("teacherResults.notes.invalid")}</div>;

                      return (
                        <div className="notes-view">
                          <div className="notes-header-card">
                            <div className="notes-title">{m.title || t("teacherResults.notes.defaultTitle")}</div>

                            <div className="notes-meta">
                              {m.date && <span className="notes-chip">{m.date}</span>}
                              <span className="notes-chip">
                                {t("teacherResults.notes.sectionsCount", { n: m.sections.length })}
                              </span>
                            </div>

                            {m.sources.length > 0 && (
                              <div className="notes-sources">
                                <div className="notes-small-label">{t("teacherResults.notes.labels.sources")}</div>
                                <ul className="notes-sources-list">
                                  {m.sources.map((src, i) => (
                                    <li key={i} className="notes-source-item">
                                      {src}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          <div className="notes-sections">
                            {m.sections.map((s) => (
                              <div key={s.idx} className="note-card">
                                <div className="note-header">
                                  <div className="note-heading">
                                    {s.heading || t("teacherResults.notes.sectionFallback", { n: s.idx })}
                                  </div>
                                </div>

                                {s.callout && (
                                  <div className="note-callout">
                                    <div className="note-label">{t("teacherResults.notes.labels.callout")}</div>
                                    <div className="note-text">{s.callout}</div>
                                  </div>
                                )}

                                {s.notes.length > 0 && (
                                  <div className="note-block">
                                    <div className="note-label">{t("teacherResults.notes.labels.notes")}</div>
                                    <div className="note-text">
                                      {s.notes.map((n, i) => (
                                        <p key={i} className="note-paragraph">
                                          {n}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {s.bullets.length > 0 && (
                                  <div className="note-block">
                                    <div className="note-label">{t("teacherResults.notes.labels.bullets")}</div>
                                    <ul className="note-bullets">
                                      {s.bullets.map((b, i) => (
                                        <li key={i}>{b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {s.terms.length > 0 && (
                                  <div className="note-block">
                                    <div className="note-label">{t("teacherResults.notes.labels.terms")}</div>
                                    <div className="terms-grid">
                                      {s.terms.map((trm, i) => (
                                        <div key={i} className="term-card">
                                          <div className="term">{trm.term}</div>
                                          <div className="definition">{trm.definition}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {s.recommendations && (
                                  <div className="note-reco">
                                    <div className="note-label">{t("teacherResults.notes.labels.recommendations")}</div>
                                    <div className="note-text">{s.recommendations}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {m.conclusion && (
                            <div className="notes-conclusion-card">
                              <div className="note-label">{t("teacherResults.notes.labels.conclusion")}</div>
                              <div className="note-text">{m.conclusion}</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </>
              )}
            </div>

            <div className="results-demo-close">
              <button className="results-back-button" onClick={() => setDemoStudent(null)}>
                {t("teacherResults.demo.close")}
              </button>
            </div>
          </div>
        )}

        <div className="results-search-row">
          <div className="results-search">
            <input
              type="text"
              placeholder={t("teacherResults.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t("teacherResults.searchAria")}
            />
          </div>
        </div>

        {loading && <div className="students-empty">{t("teacherResults.loading")}</div>}
        {!loading && err && <div className="students-empty">{err}</div>}

        {!loading && !err && (
          <div className="results-grid">
            {filtered.map((item) => (
              <div key={item.id} className="results-card">
                <div className="results-name">{item.displayName}</div>

                <div className="results-mini-actions" style={{ marginTop: 10 }}>
                  <button
                    className="results-mini-link"
                    type="button"
                    onClick={() => openDemo(item, "notes")}
                  >
                    {t("teacherResults.cards.notes")}
                  </button>
                  <button
                    className="results-mini-link"
                    type="button"
                    onClick={() => openDemo(item, "task")}
                  >
                    {t("teacherResults.cards.tasks")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="results-footer">
          <a
            href={surveyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="results-back-button"
          >
            {t("teacherResults.footer.survey")}
          </a>
        </div>
      </div>
    </div>
  );
};

export default TeacherResults;