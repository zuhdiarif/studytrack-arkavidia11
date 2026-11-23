import React from "react";

function resolveSeconds(remainingSeconds, remainingHours) {
  if (typeof remainingSeconds === "number" && Number.isFinite(remainingSeconds)) {
    return remainingSeconds;
  }
  if (typeof remainingHours === "number" && Number.isFinite(remainingHours)) {
    return Math.round(remainingHours * 3600);
  }
  return null;
}

function formatNearText(seconds) {
  if (seconds === null) return "";
  if (seconds < 60) return "Sisa < 1m";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `Sisa ${hours}j ${minutes}m`;
  if (hours > 0) return `Sisa ${hours}j`;
  return `Sisa ${minutes}m`;
}

function formatOverdueText(seconds) {
  if (seconds === null) return "";
  const absSeconds = Math.abs(seconds);
  if (absSeconds < 60) return "Baru saja lewat";
  const totalMinutes = Math.floor(absSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours === 0) return `Terlewat ${totalMinutes}m`;
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  if (days === 0) return `Terlewat ${totalHours}j`;
  if (remHours === 0) return `Terlewat ${days}h`;
  return `Terlewat ${days}h ${remHours}j`;
}

export default function DeadlineBadge({ category, remainingHours, remainingSeconds }) {
  if (category !== "NEAR" && category !== "OVERDUE") {
    return null;
  }

  const seconds = resolveSeconds(remainingSeconds, remainingHours);

  if (category === "NEAR") {
    const timeLabel = formatNearText(seconds);
    return (
      <div className="deadline-badge-row">
        <span className="deadline-badge near">⏰ Mendekati Deadline (&lt; 24 Jam)</span>
        {timeLabel && <span className="deadline-time near">{timeLabel}</span>}
      </div>
    );
  }

  const overdueLabel = formatOverdueText(seconds);
  return (
    <div className="deadline-badge-row">
      <span className="deadline-badge overdue">⚠️ Terlambat / Overdue</span>
      {overdueLabel && <span className="deadline-time overdue">{overdueLabel}</span>}
    </div>
  );
}
