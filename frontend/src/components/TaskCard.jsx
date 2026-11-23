import React, { useEffect, useState } from "react";
import { requestTaskAiPlan } from "../api.js";
import AiPlanPanel from "./AiPlanPanel.jsx";
import DeadlineBadge from "./DeadlineBadge.jsx";

function formatDeadline(deadline) {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function TaskCard({ task, onToggleStatus, onDelete }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiError, setAiError] = useState("");

  const category = task.deadline_category || "NORMAL";
  const variantClass =
    category === "NEAR" ? "near" : category === "OVERDUE" ? "overdue" : "";
  const courseLabel = task.kode_mata_kuliah
    ? `${task.kode_mata_kuliah} · ${task.mata_kuliah || ""}`
    : task.mata_kuliah;
  const isIncomplete = task.status === "belum";

  useEffect(() => {
    if (!isIncomplete) {
      setAiOpen(false);
    }
  }, [isIncomplete]);

  async function fetchPlan() {
    setAiOpen(true);
    setAiLoading(true);
    setAiError("");
    try {
      const data = await requestTaskAiPlan(task.id);
      setAiPlan(data.plan || null);
    } catch (err) {
      setAiError(err.response?.data?.error || "Gagal membuat rencana kerja AI.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiButtonClick() {
    if (aiOpen && !aiLoading) {
      setAiOpen(false);
      return;
    }
    if (aiPlan && !aiError) {
      setAiOpen(true);
      return;
    }
    fetchPlan();
  }

  const aiButtonVariant =
    category === "NEAR" ? "near" : category === "OVERDUE" ? "overdue" : "normal";

  return (
    <div className={`card task-card ${variantClass}`.trim()} data-category={category}>
      <div className="task-card-row">
        <div className="task-card-main">
          <DeadlineBadge
            category={category}
            remainingHours={task.remaining_hours}
            remainingSeconds={task.remaining_seconds}
          />
          <strong className="task-title">{task.judul}</strong>
          {courseLabel && <div className="meta">{courseLabel}</div>}
          <div className="meta">Deadline: {formatDeadline(task.deadline)}</div>
          {task.deskripsi && <div className="meta">{task.deskripsi}</div>}
        </div>
        <div className="task-card-actions">
          <span className={`badge ${task.status}`}>
            {task.status === "selesai" ? "Selesai" : "Belum"}
          </span>
          <div className="task-action-buttons">
            {isIncomplete && (
              <button
                type="button"
                className={`btn btn-ai ${aiButtonVariant}`}
                onClick={handleAiButtonClick}
                disabled={aiLoading}
                aria-expanded={aiOpen}
              >
                {aiLoading ? "Menyusun AI..." : "✨ Rencana Kerja AI"}
              </button>
            )}
            <button type="button" className="btn" onClick={() => onToggleStatus(task)}>
              {task.status === "selesai" ? "Tandai Belum" : "Tandai Selesai"}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(task.id)}>
              Hapus
            </button>
          </div>
        </div>
      </div>

      {isIncomplete && aiOpen && (
        <AiPlanPanel
          plan={aiPlan}
          loading={aiLoading}
          error={aiError}
          category={category}
          onRegenerate={fetchPlan}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}
