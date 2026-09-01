import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./Walkthrough.css";

import teacherFormsImg from "../assets/walkthrough/teacher/teacher_forms.png";

const TeacherWalkthrough = ({ onClose, onConfirmCsvType }) => {
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState(0);
  const [csvType, setCsvType] = useState(""); // "moodle" | "custom"

  const lang = (i18n.resolvedLanguage || i18n.language || "sk").split("-")[0];

  const CUSTOM_TEMPLATE_URL = useMemo(() => {
    const byLang = {
      sk: "https://docs.google.com/forms/d/1jQ54HlfgYCmcp2PVhSbhuqXOlpl3aUVnp7YFicD0Z64/copy", 
      uk: "https://docs.google.com/forms/d/1yZq-zg0dnDqZXFXfep6Xxpb6qejjNEe5yr01D9dQJes/copy",
    };
    return byLang[lang] ?? byLang.sk;
  }, [lang]);


  const radioRow = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    cursor: "pointer",
  };

  const radioTitle = {
    fontWeight: 600,
    lineHeight: 1.25,
    marginBottom: 4,
  };

  const radioHint = {
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 1.3,
  };

  const radioInputStyle = {
    marginTop: 3,
    flex: "0 0 auto",
  };

  const baseSlides = useMemo(
    () => [
      {
        key: "intro",
        kind: "intro",
        title: t("walkthrough.teacher.slides.intro.title"),
        text: (
          <>
            {t("walkthrough.teacher.slides.intro.p1")} <b>{t("walkthrough.teacher.slides.intro.p1Bold")}</b>{" "}
            {t("walkthrough.teacher.slides.intro.p1After")}
            <br />
            <br />
            {t("walkthrough.teacher.slides.intro.p2")}
          </>
        ),
      },
      {
        key: "howto",
        kind: "howto",
        title: t("walkthrough.teacher.slides.howto.title"),
        text: (
          <>
            {t("walkthrough.teacher.slides.howto.p1")}
            <ul style={{ marginTop: 10 }}>
              <li>
                <b>{t("walkthrough.teacher.slides.howto.list.csvBold")}</b>{" "}
                {t("walkthrough.teacher.slides.howto.list.csvText")}
              </li>
              <li>
                <b>{t("walkthrough.teacher.slides.howto.list.materialsBold")}</b>{" "}
                {t("walkthrough.teacher.slides.howto.list.materialsText")}
              </li>
            </ul>
            {t("walkthrough.teacher.slides.howto.p2")}
          </>
        ),
      },
      {
        key: "picker",
        kind: "picker",
        title: t("walkthrough.teacher.slides.picker.title"),
        text: (
          <>
            {t("walkthrough.teacher.slides.picker.p1")}
            <br />
            {t("walkthrough.teacher.slides.picker.p2")}
          </>
        ),
      },
    ],
    [t]
  );

  const customSlides = useMemo(
    () => [
      {
        key: "custom_info",
        kind: "custom_info",
        title: t("walkthrough.teacher.slides.customInfo.title"),
        img: teacherFormsImg,
        text: (
          <>
            {t("walkthrough.teacher.slides.customInfo.p1")} <b>{t("walkthrough.teacher.slides.customInfo.p1Bold")}</b>,{" "}
            {t("walkthrough.teacher.slides.customInfo.p1After")}{" "}
            <a
              href={CUSTOM_TEMPLATE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t("walkthrough.teacher.slides.customInfo.linkText")}
            </a>
            . {t("walkthrough.teacher.slides.customInfo.warning")}
            <br />
            <br />
            {t("walkthrough.teacher.slides.customInfo.steps.1")}
            <br />
            {t("walkthrough.teacher.slides.customInfo.steps.2")}
            <br />
            {t("walkthrough.teacher.slides.customInfo.steps.3")}
          </>
        ),
      },
    ],
    [t]
  );

  const slides = useMemo(() => {
    if (!csvType) return baseSlides;
    if (csvType === "moodle") return baseSlides;
    return [...baseSlides, ...customSlides];
  }, [baseSlides, customSlides, csvType]);

  const isLast = step === slides.length - 1;
  const slide = slides[step];

  const goNext = () => setStep((s) => Math.min(s + 1, slides.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const canProceedFromPicker = slide.kind !== "picker" || !!csvType;

  const finish = () => {
    if (onConfirmCsvType) onConfirmCsvType(csvType || "moodle");
    onClose?.();
  };

  return (
    <div className="walkthrough-overlay">
      <div className="walkthrough-card">
        <div className="walkthrough-header">{t("walkthrough.teacher.header")}</div>

        {slide.kind === "custom_info" && slide.img && (
          <img
            src={slide.img}
            alt=""
            style={{ width: "100%", borderRadius: 12, marginBottom: 12 }}
          />
        )}

        <h3>{slide.title}</h3>
        <p>{slide.text}</p>

        {slide.kind === "picker" && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Moodle */}
            <label style={radioRow}>
              <input
                style={radioInputStyle}
                type="radio"
                name="csvType"
                value="moodle"
                checked={csvType === "moodle"}
                onChange={(e) => setCsvType(e.target.value)}
              />
              <div>
                <div style={radioTitle}>{t("walkthrough.teacher.picker.moodle.title")}</div>
                <div style={radioHint}>{t("walkthrough.teacher.picker.moodle.hint")}</div>
              </div>
            </label>

            {/* Custom */}
            <label style={radioRow}>
              <input
                style={radioInputStyle}
                type="radio"
                name="csvType"
                value="custom"
                checked={csvType === "custom"}
                onChange={(e) => setCsvType(e.target.value)}
              />
              <div>
                <div style={radioTitle}>{t("walkthrough.teacher.picker.custom.title")}</div>
                <div style={radioHint}>
                  {t("walkthrough.teacher.picker.custom.hintBefore")}{" "}
                  <a
                    href={CUSTOM_TEMPLATE_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("walkthrough.teacher.picker.custom.linkText")}
                  </a>
                  .
                </div>
              </div>
            </label>
          </div>
        )}

        <div className="walkthrough-actions" style={{ gap: 8, marginTop: 16 }}>
          {step > 0 && (
            <button onClick={goBack}>
              {t("walkthrough.actions.back")}
            </button>
          )}

          {!isLast ? (
            <button
              onClick={goNext}
              disabled={!canProceedFromPicker}
              style={{ opacity: canProceedFromPicker ? 1 : 0.5 }}
            >
              {t("walkthrough.actions.next")}
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={slide.kind === "picker" && !csvType}
              style={{ opacity: slide.kind !== "picker" || csvType ? 1 : 0.5 }}
              title={slide.kind === "picker" && !csvType ? t("walkthrough.teacher.picker.chooseCsvType") : ""}
            >
              {t("walkthrough.actions.start")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherWalkthrough;