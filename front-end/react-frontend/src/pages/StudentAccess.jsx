import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./StudentAccess.css";

const StudentAccess = () => {
  const { t } = useTranslation();

  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [batchId, setBatchId] = useState(params.get("batch") || "");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const openLink = (url) => {
    if (!url) return;
    const full = window.location.origin + url;
    window.open(full, "_blank", "noopener,noreferrer");
  };

  const onSubmit = async () => {
    setErr("");
    setData(null);

    const b = batchId.trim();
    const e = email.trim().toLowerCase();
    const p = pin.trim();

    if (!b) return setErr(t("studentAccess.errors.batchRequired"));
    if (!e || !e.includes("@")) return setErr(t("studentAccess.errors.emailInvalid"));
    if (p.length < 4) return setErr(t("studentAccess.errors.pinTooShort"));

    try {
      setLoading(true);

      const res = await fetch(`/api/batch/${encodeURIComponent(b)}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, pin: p }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(json?.error || t("studentAccess.errors.accessFailed"));
        return;
      }

      setData(json);

      localStorage.setItem(
        "studentAccess",
        JSON.stringify({
          batchId: json.batchId,
          stem: json.stem,
          displayName: json.displayName,
          email: e,
          pdf: json.pdf,
          notes: json.notes,
          task: json.task,
        })
      );

      navigate(
        `/recommendations?batch=${encodeURIComponent(json.batchId)}&stem=${encodeURIComponent(json.stem)}`
      );
    } catch (e2) {
      setErr(e2?.message || t("studentAccess.errors.serverConnection"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-access-wrapper">
      <div className="student-access-card">
        <h2 className="student-access-title">{t("studentAccess.title")}</h2>

        <div className="student-access-field">
          <label>{t("studentAccess.fields.batch.label")}</label>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder={t("studentAccess.fields.batch.placeholder")}
            disabled={loading}
          />
          <div className="student-access-hint">{t("studentAccess.fields.batch.hint")}</div>
        </div>

        <div className="student-access-field">
          <label>{t("studentAccess.fields.email.label")}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("studentAccess.fields.email.placeholder")}
            disabled={loading}
          />
        </div>

        <div className="student-access-field">
          <label>{t("studentAccess.fields.pin.label")}</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t("studentAccess.fields.pin.placeholder")}
            disabled={loading}
          />
        </div>

        {err && <div className="student-access-error">{err}</div>}

        <button className="student-access-btn" onClick={onSubmit} disabled={loading}>
          {loading ? t("studentAccess.loading") : t("studentAccess.submit")}
        </button>

        {data && (
          <div className="student-access-results">
            <div className="student-access-hello">
              {data.displayName
                ? t("studentAccess.helloNamed", { name: data.displayName })
                : t("studentAccess.ready")}
            </div>

            <div className="student-access-actions">
              <button onClick={() => openLink(data?.pdf?.url)} className="student-access-link">
                {t("studentAccess.actions.openPdf")}
              </button>

              <button
                onClick={() => openLink(data?.notes?.url)}
                className="student-access-link"
                disabled={!data?.notes?.exists}
                title={!data?.notes?.exists ? t("studentAccess.actions.notesNotReady") : ""}
              >
                {t("studentAccess.actions.notes")}
              </button>

              <button
                onClick={() => openLink(data?.task?.url)}
                className="student-access-link"
                disabled={!data?.task?.exists}
                title={!data?.task?.exists ? t("studentAccess.actions.tasksNotReady") : ""}
              >
                {t("studentAccess.actions.tasks")}
              </button>
            </div>

            <div className="student-access-mini">
              {t("studentAccess.meta.batch")} <b>{data.batchId}</b> • {t("studentAccess.meta.stem")}{" "}
              <b>{data.stem}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAccess;