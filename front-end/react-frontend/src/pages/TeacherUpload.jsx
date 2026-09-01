import React, { useMemo, useRef, useState } from "react";
import "./TeacherUpload.css";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TeacherWalkthrough from "../components/TeacherWalkthrough";

const TeacherUpload = () => {
  const { t, i18n } = useTranslation();

  const [csvFile, setCsvFile] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [batchId, setBatchId] = useState(null);

  const [csvType, setCsvType] = useState("moodle");
  const [showWalkthrough, setShowWalkthrough] = useState(true);

  const [uiError, setUiError] = useState("");
  const [uiInfo, setUiInfo] = useState("");

  const fileInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const courseId = params.get("course");

  const lang = (i18n.resolvedLanguage || i18n.language || "sk").split("-")[0];

  const extOf = (file) => (file?.name?.split(".").pop() || "").toLowerCase();
  const isCsv = (file) => extOf(file) === "csv";
  const isMaterial = (file) => ["pdf", "pptx", "docx"].includes(extOf(file));

  const getText = (sk, uk, en) => {
    if (lang === "uk") return uk;
    if (lang === "en") return en;
    return sk;
  };

  const invalidFileMessage = getText(
    "Niektoré súbory neboli pridané. Povolené formáty sú: CSV pre odpovede a PDF, PPTX, DOCX pre materiály.",
    "Деякі файли не були додані. Дозволені формати: CSV для відповідей та PDF, PPTX, DOCX для матеріалів.",
    "Some files were not added. Allowed formats are CSV for responses and PDF, PPTX, DOCX for materials."
  );

  const csvMissingMessage = getText(
    "Najprv nahrajte CSV súbor s odpoveďami študentov.",
    "Спочатку завантажте CSV-файл з відповідями студентів.",
    "Please upload the CSV file with student responses first."
  );

  const uploadFailedMessage = getText(
    "Nahrávanie sa nepodarilo.",
    "Не вдалося завантажити файли.",
    "Upload failed."
  );

  const processingInfoMessage = getText(
    "Súbory sa nahrávajú a spracúvajú.",
    "Файли завантажуються та обробляються.",
    "Files are being uploaded and processed."
  );

  const updateStatusReadyIfAny = (nextCsv, nextMaterials) => {
    if (nextCsv || nextMaterials.length) setStatus("ready");
    else setStatus("idle");
  };

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;

    setUiError("");
    setUiInfo("");

    const csvs = arr.filter(isCsv);
    const mats = arr.filter(isMaterial);
    const invalid = arr.filter((file) => !isCsv(file) && !isMaterial(file));

    if (csvs.length) {
      setCsvFile(csvs[csvs.length - 1]);
    }

    if (mats.length) {
      setMaterials((prev) => {
        const key = (f) => `${f.name}-${f.size}-${f.lastModified}`;
        const map = new Map(prev.map((f) => [key(f), f]));
        mats.forEach((f) => map.set(key(f), f));
        return Array.from(map.values());
      });
    }

    if (csvs.length || mats.length) {
      setStatus("ready");
    }

    if (invalid.length) {
      setUiError(invalidFileMessage);
    }
  };

  const onFileInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (status === "processing") return;
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => e.preventDefault();

  const removeCsv = () => {
    setCsvFile(null);
    updateStatusReadyIfAny(null, materials);
  };

  const removeMaterial = (name) => {
    const updated = materials.filter((f) => f.name !== name);
    setMaterials(updated);
    updateStatusReadyIfAny(csvFile, updated);
  };

  const uploadOne = async (file, existingBatchId) => {
    const fd = new FormData();
    fd.append("file", file);

    if (existingBatchId) {
      fd.append("batchId", existingBatchId);
    }

    if (extOf(file) === "csv") {
      fd.append("csvType", csvType);
    }

    const res = await fetch("/upload", {
      method: "POST",
      body: fd,
    });

    let payload = null;
    const text = await res.text().catch(() => "");

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const message =
        payload?.error ||
        payload?.message ||
        text ||
        t("teacherUpload.errors.uploadFailed", { status: res.status }) ||
        uploadFailedMessage;

      throw new Error(message);
    }

    return payload ?? {};
  };

  const startGenerate = async () => {
    if (!csvFile) {
      setUiError(t("teacherUpload.errors.csvRequired") || csvMissingMessage);
      return;
    }

    try {
      setUiError("");
      setUiInfo(processingInfoMessage);
      setBatchId(null);
      setStatus("processing");
      setProgress(5);

      const csvResponse = await uploadOne(csvFile, batchId);
      const newBatchId = csvResponse.batchId;

      if (!newBatchId) {
        throw new Error(uploadFailedMessage);
      }

      setBatchId(newBatchId);

      const total = materials.length;
      for (let i = 0; i < total; i += 1) {
        const p = 10 + Math.round(((i + 1) / total) * 80);
        setProgress(p);
        await uploadOne(materials[i], newBatchId);
      }

      setProgress(100);
      setUiInfo("");

      setTimeout(() => {
        navigate(`/teacher/students?batch=${encodeURIComponent(newBatchId)}`);
      }, 400);
    } catch (e) {
      setUiInfo("");
      setUiError(e?.message || t("teacherUpload.errors.uploadGeneric") || uploadFailedMessage);
      setStatus("ready");
      setProgress(0);
    }
  };

  return (
    <>
      {showWalkthrough && (
        <TeacherWalkthrough
          onClose={() => setShowWalkthrough(false)}
          onConfirmCsvType={(type) => setCsvType(type)}
        />
      )}

      <div className="upload-wrapper">
        <div className="upload-card">
          <h2 className="upload-title">{t("teacherUpload.title")}</h2>

          <p className="upload-subtitle">
            {t("teacherUpload.subtitle")}
            {courseId && <br />}
          </p>

          {uiError && (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(220, 80, 80, 0.08)",
                border: "1px solid rgba(220, 80, 80, 0.18)",
                color: "rgba(120, 20, 20, 0.92)",
                lineHeight: 1.45,
              }}
            >
              {uiError}
            </div>
          )}

          {!uiError && uiInfo && (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(174, 197, 157, 0.12)",
                border: "1px solid rgba(146, 169, 129, 0.22)",
                color: "rgba(0, 0, 0, 0.72)",
                lineHeight: 1.45,
              }}
            >
              {uiInfo}
            </div>
          )}

          <div
            className={`upload-dropzone ${status === "processing" ? "upload-dropzone-disabled" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => status !== "processing" && fileInputRef.current?.click()}
          >
            {status === "idle" && (
              <div className="upload-empty-state">
                <button
                  type="button"
                  className="upload-choose-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t("teacherUpload.chooseFiles")}
                </button>
                <p className="upload-hint">{t("teacherUpload.orDragHere")}</p>
                <p className="upload-subhint">{t("teacherUpload.supported")}</p>
              </div>
            )}

            {status === "ready" && (
              <div className="upload-files-grid">
                {csvFile && (
                  <div className="upload-file-card upload-file-card--csv">
                    <div className="upload-file-icon">📊</div>
                    <div className="upload-file-name" title={csvFile.name}>
                      {csvFile.name}
                      <span className="upload-file-badge">CSV</span>
                    </div>
                    <button
                      type="button"
                      className="upload-file-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCsv();
                      }}
                      aria-label={t("teacherUpload.remove")}
                      title={t("teacherUpload.remove")}
                    >
                      ×
                    </button>
                  </div>
                )}

                {materials.map((file) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="upload-file-card"
                  >
                    <div className="upload-file-icon">📄</div>
                    <div className="upload-file-name" title={file.name}>
                      {file.name}
                      <span className="upload-file-badge">{extOf(file).toUpperCase()}</span>
                    </div>
                    <button
                      type="button"
                      className="upload-file-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMaterial(file.name);
                      }}
                      aria-label={t("teacherUpload.remove")}
                      title={t("teacherUpload.remove")}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {!csvFile && (
                  <div className="upload-inline-hint">
                    {t("teacherUpload.needCsvHintPrefix")} <b>{t("teacherUpload.needCsvHintBold")}</b>{" "}
                    {t("teacherUpload.needCsvHintSuffix")}
                  </div>
                )}
              </div>
            )}

            {status === "processing" && (
              <div className="upload-progress-state">
                <div className="upload-progress-bar">
                  <div className="upload-progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="upload-progress-text">
                  {t("teacherUpload.processing")} {progress}%
                </p>
              </div>
            )}

            <input
              type="file"
              multiple
              accept=".csv,.pdf,.pptx,.docx"
              className="upload-file-input"
              ref={fileInputRef}
              onChange={onFileInputChange}
            />
          </div>

          <div className="upload-actions">
            <button
              type="button"
              className="upload-generate-button"
              onClick={startGenerate}
              disabled={status === "processing"}
            >
              {t("teacherUpload.generate")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherUpload;