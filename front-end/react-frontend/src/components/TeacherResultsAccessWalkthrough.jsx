import React from "react";
import { useTranslation } from "react-i18next";
import "./TeacherResultsAccessWalkthrough.css";

const TeacherResultsAccessWalkthrough = ({
  open,
  step,
  onClose,
  onGenerate,
  onSave,
  onCopy,
  pinInput,
  pinLoading,
  canSave,
  canCopy,
}) => {
  const { t } = useTranslation();

  if (!open || step === "done") return null;

  const stepsMap = {
    generate: {
      index: 1,
      title: t("teacherResults.accessWalkthrough.generate.title"),
      text: t("teacherResults.accessWalkthrough.generate.text"),
      actionLabel: t("teacherResults.access.generatePin"),
      onAction: onGenerate,
      disabled: pinLoading,
    },
    save: {
      index: 2,
      title: t("teacherResults.accessWalkthrough.save.title"),
      text: t("teacherResults.accessWalkthrough.save.text"),
      actionLabel: t("teacherResults.access.savePin"),
      onAction: onSave,
      disabled: pinLoading || !canSave,
    },
    copy: {
      index: 3,
      title: t("teacherResults.accessWalkthrough.copy.title"),
      text: t("teacherResults.accessWalkthrough.copy.text"),
      actionLabel: t("teacherResults.access.copyAccess"),
      onAction: onCopy,
      disabled: !canCopy,
    },
  };

  const current = stepsMap[step] || stepsMap.generate;

  return (
    <div className="results-walkthrough-overlay">
      <div className="results-walkthrough-card">
        <div className="results-walkthrough-header">
          {t("teacherResults.accessWalkthrough.header")}
        </div>

        <div className="results-walkthrough-body">
          <div className="results-walkthrough-badge">
            {t("teacherResults.accessWalkthrough.step", {
              current: current.index,
              total: 3,
            })}
          </div>

          <h3>{current.title}</h3>
          <p>{current.text}</p>

          {step === "save" && !!pinInput?.trim() && (
            <div className="results-walkthrough-preview">
              <div className="results-walkthrough-preview-label">
                {t("teacherResults.access.pinLabel")}
              </div>
              <div className="results-walkthrough-preview-value">{pinInput}</div>
            </div>
          )}
        </div>

        <div className="results-walkthrough-actions">
          <button type="button" onClick={onClose}>
            {t("teacherResults.accessWalkthrough.hide")}
          </button>

          <button
            type="button"
            onClick={current.onAction}
            disabled={current.disabled}
            style={{ opacity: current.disabled ? 0.55 : 1 }}
          >
            {current.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherResultsAccessWalkthrough;