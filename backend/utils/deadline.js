export const TWENTY_FOUR_HOURS_SEC = 86400;

export const PRIORITY = Object.freeze({
  NEAR: 1,
  OVERDUE: 2,
  NORMAL: 3
});

const NAIVE_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseDeadlineDate(deadlineStr) {
  if (deadlineStr instanceof Date) {
    return Number.isNaN(deadlineStr.getTime()) ? null : new Date(deadlineStr.getTime());
  }
  if (typeof deadlineStr !== "string") {
    return null;
  }

  const trimmed = deadlineStr.trim();
  if (!trimmed) return null;

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/i.test(trimmed);
  if (!hasExplicitTimezone) {
    const match = trimmed.match(NAIVE_DATETIME_RE);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = match[6] ? Number(match[6]) : 0;
      const ms = match[7] ? Number(match[7].padEnd(3, "0")) : 0;
      const localDate = new Date(year, month - 1, day, hour, minute, second, ms);
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }
  }

  const parsed = new Date(trimmed.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDeadlineCategory(deadlineStr, status, now = new Date()) {
  if (status === "selesai") {
    return "NORMAL";
  }

  const deadlineDate = parseDeadlineDate(deadlineStr);
  const nowDate = parseDeadlineDate(now);
  if (!deadlineDate || !nowDate) {
    return "NORMAL";
  }

  const diffSeconds = (deadlineDate.getTime() - nowDate.getTime()) / 1000;
  if (diffSeconds > 0 && diffSeconds < TWENTY_FOUR_HOURS_SEC) {
    return "NEAR";
  }
  if (diffSeconds <= 0) {
    return "OVERDUE";
  }
  return "NORMAL";
}

export function enrichTaskWithDeadline(task, now = new Date()) {
  const nowDate = parseDeadlineDate(now) || new Date();
  const deadlineDate = parseDeadlineDate(task.deadline);
  const diffSeconds = deadlineDate
    ? (deadlineDate.getTime() - nowDate.getTime()) / 1000
    : null;

  return {
    ...task,
    deadline_category: getDeadlineCategory(task.deadline, task.status, nowDate),
    remaining_hours: diffSeconds !== null ? Number((diffSeconds / 3600).toFixed(2)) : null,
    remaining_seconds: diffSeconds !== null ? Math.round(diffSeconds) : null
  };
}

export function enrichAndSortTasks(tasks, now = new Date()) {
  const nowDate = parseDeadlineDate(now) || new Date();

  return tasks
    .map((task) => enrichTaskWithDeadline(task, nowDate))
    .sort((a, b) => {
      const priorityDiff =
        (PRIORITY[a.deadline_category] ?? PRIORITY.NORMAL) -
        (PRIORITY[b.deadline_category] ?? PRIORITY.NORMAL);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (a.deadline_category === "NEAR" || a.deadline_category === "OVERDUE") {
        const aDeadline = parseDeadlineDate(a.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDeadline = parseDeadlineDate(b.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aDeadline !== bDeadline) {
          return aDeadline - bDeadline;
        }
      }

      const aCreated = parseDeadlineDate(a.created_at)?.getTime() ?? 0;
      const bCreated = parseDeadlineDate(b.created_at)?.getTime() ?? 0;
      return bCreated - aCreated;
    });
}
