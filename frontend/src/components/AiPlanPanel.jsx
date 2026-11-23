import React, { useEffect, useState } from "react";

export default function AiPlanPanel({
  plan,
  loading,
  error,
  category,
  onRegenerate,
  onClose
}) {
  const [checkedSteps, setCheckedSteps] = useState({});

  useEffect(() => {
    setCheckedSteps({});
  }, [plan]);

  function toggleStep(index) {
    setCheckedSteps((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  }

  const variantClass =
    category === "NEAR" ? "near" : category === "OVERDUE" ? "overdue" : "normal";

  if (loading) {
    return (
      <div className={`ai-plan-panel ${variantClass}`} role="status" aria-live="polite">
        <div className="ai-plan-header">
          <div className="ai-plan-title-group">
            <strong className="ai-plan-title">✨ Rencana Kerja AI</strong>
          </div>
          <button type="button" className="ai-plan-close" onClick={onClose}>
            Tutup
          </button>
        </div>
        <p className="ai-plan-loading">Menyusun langkah prioritas berdasarkan deadline tugas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`ai-plan-panel ${variantClass}`} role="alert">
        <div className="ai-plan-header">
          <strong className="ai-plan-title">✨ Rencana Kerja AI</strong>
          <button type="button" className="ai-plan-close" onClick={onClose}>
            Tutup
          </button>
        </div>
        <p className="error ai-plan-error">{error}</p>
        <button type="button" className="ai-plan-refresh" onClick={onRegenerate}>
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  const isGemini = plan.source === "gemini";
  const completedCount = Object.values(checkedSteps).filter(Boolean).length;
  const totalSteps = Array.isArray(plan.steps) ? plan.steps.length : 0;

  return (
    <div className={`ai-plan-panel ${variantClass}`} data-source={plan.source}>
      <div className="ai-plan-header">
        <div className="ai-plan-title-group">
          <strong className="ai-plan-title">✨ Rencana Kerja AI</strong>
          <span
            className={`ai-source-badge ${isGemini ? "gemini" : "fallback"}`}
            title={plan.model ? `Model: ${plan.model}` : undefined}
          >
            {isGemini ? "Gemini AI" : "Mode Panduan Lokal"}
          </span>
          {typeof plan.estimated_total_minutes === "number" && (
            <span className="ai-duration-total">Est. {plan.estimated_total_minutes} mnt</span>
          )}
        </div>
        <div className="ai-plan-header-actions">
          <button type="button" className="ai-plan-refresh" onClick={onRegenerate}>
            Perbarui
          </button>
          <button type="button" className="ai-plan-close" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>

      <p className="ai-urgency-summary">{plan.urgency_summary}</p>

      <div className="ai-first-action">
        <span className="ai-first-action-label">Mulai 5 Menit Pertama:</span>
        <p className="ai-first-action-text">{plan.first_action_now}</p>
      </div>

      <div className="ai-steps-header">
        <span>Langkah Eksekusi</span>
        <span className="ai-steps-progress">
          {completedCount}/{totalSteps} selesai
        </span>
      </div>

      <ol className="ai-steps-list">
        {(plan.steps || []).map((item, idx) => {
          const isChecked = Boolean(checkedSteps[idx]);
          return (
            <li key={idx} className={`ai-step-item ${isChecked ? "checked" : ""}`}>
              <label className="ai-step-label">
                <input
                  type="checkbox"
                  className="ai-step-checkbox"
                  checked={isChecked}
                  onChange={() => toggleStep(idx)}
                />
                <span className="ai-step-number">{idx + 1}.</span>
                <span className="ai-step-content">
                  <span className="ai-step-top">
                    <span className="ai-step-text">{item.step}</span>
                    <span className="ai-step-duration">{item.duration_minutes} mnt</span>
                  </span>
                  {item.tip && <span className="ai-step-tip">Tips: {item.tip}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ol>

      {!isGemini && (
        <p className="ai-fallback-note">
          {plan.fallback_reason === "missing_api_key"
            ? "Panduan lokal aktif karena GEMINI_API_KEY belum dikonfigurasi di backend/.env."
            : "Layanan Gemini sedang tidak dapat dijangkau; menampilkan panduan lokal otomatis."}
        </p>
      )}
    </div>
  );
}
