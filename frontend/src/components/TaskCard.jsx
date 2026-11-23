import React from "react";
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
  const category = task.deadline_category || "NORMAL";
  const variantClass =
    category === "NEAR" ? "near" : category === "OVERDUE" ? "overdue" : "";
  const courseLabel = task.kode_mata_kuliah
    ? `${task.kode_mata_kuliah} · ${task.mata_kuliah || ""}`
    : task.mata_kuliah;

  return (
    <div className={`card task-card ${variantClass}`.trim()} data-category={category}>
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
          <button className="btn" onClick={() => onToggleStatus(task)}>
            {task.status === "selesai" ? "Tandai Belum" : "Tandai Selesai"}
          </button>
          <button className="btn btn-danger" onClick={() => onDelete(task.id)}>
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
