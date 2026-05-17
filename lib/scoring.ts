import { todayIso } from "./date";
import type { AppData, Item, LogStatus, Plan, Priority, Task } from "./types";

export const priorityWeights: Record<Priority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 5,
};

export function letterGrade(score: number) {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 60) return "D";
  return "F";
}

function itemScore(item: Pick<Item, "tracking_type" | "default_target">, actual: number, status: LogStatus, date: string) {
  if (status === "pending" && date < todayIso()) return 0;
  if (status === "pending") return null;
  if (status === "missed") return 0;
  if (item.tracking_type === "done") return 1;
  const actualNum = Number(actual || 0);
  if (actualNum <= 0) return 1;
  return Math.max(0, Math.min(actualNum / Number(item.default_target || 1), 1));
}

export function scoreForDate(data: AppData, date: string) {
  const rows: Array<{
    plan: Plan;
    entity: Item | Task;
    status: LogStatus;
    score: number | null;
    weight: number;
    actual: number;
    notes: string;
    name: string;
  }> = [];
  let earned = 0;
  let possible = 0;
  let pending = 0;

  data.plans
    .filter((plan) => plan.date === date && plan.scheduled)
    .forEach((plan) => {
      const item = plan.item_id ? data.items.find((candidate) => candidate.id === plan.item_id) : null;
      const task = plan.task_id ? data.tasks.find((candidate) => candidate.id === plan.task_id) : null;
      const entity = item || task;
      if (!entity) return;

      const log = data.logs.find(
        (candidate) =>
          candidate.date === date &&
          candidate.item_id === plan.item_id &&
          candidate.task_id === plan.task_id &&
          candidate.is_extra === false,
      );
      const status = log?.status || (date < todayIso() ? "missed" : "pending");
      const score = item
        ? itemScore({ ...item, default_target: plan.target || item.default_target }, log?.actual_value || 0, status, date)
        : itemScore({ tracking_type: "done", default_target: 1 }, log?.actual_value || 0, status, date);
      const weight = priorityWeights[(entity as Item | Task).priority] || 2;

      possible += weight;
      if (score === null) pending += 1;
      else earned += score * weight;
      rows.push({
        plan,
        entity,
        status,
        score,
        weight,
        actual: log?.actual_value || 0,
        notes: log?.notes || "",
        name: item ? item.name : (task as Task).title,
      });
    });

  const plannedPercent = possible ? Math.round((earned / possible) * 100) : 0;
  const extraUnits = data.logs
    .filter((log) => log.date === date && log.is_extra)
    .reduce((sum, log) => sum + Number(log.actual_value || 0), 0);
  const bonus = Math.min(5, Math.round(extraUnits * 2));
  const finalPercent = Math.min(100, plannedPercent + bonus);

  return {
    date,
    rows,
    earned,
    possible,
    pending,
    plannedPercent,
    bonus,
    finalPercent,
    letter: letterGrade(finalPercent),
  };
}

export function aggregateScores(data: AppData, dates: string[]) {
  const scored = dates.map((date) => scoreForDate(data, date)).filter((score) => score.possible > 0);
  const avg = scored.length ? Math.round(scored.reduce((sum, score) => sum + score.finalPercent, 0) / scored.length) : 0;
  return { avg, letter: letterGrade(avg), count: scored.length };
}

// Per-habit streaks. A "hit" day is one where the habit was scheduled AND
// the log for that day has status === "complete". Today never breaks a streak
// even if it hasn't been logged yet.
export function streaksForItem(data: AppData, itemId: string, today: string) {
  const scheduledDates = new Set(
    data.plans
      .filter((plan) => plan.scheduled && plan.item_id === itemId)
      .map((plan) => plan.date),
  );
  if (scheduledDates.size === 0) return { current: 0, longest: 0 };
  const logsByDate = new Map<string, boolean>();
  data.logs
    .filter((log) => log.item_id === itemId && !log.is_extra)
    .forEach((log) => logsByDate.set(log.date, log.status === "complete"));

  const sortedDates = [...scheduledDates].sort();
  let longest = 0;
  let run = 0;
  for (const date of sortedDates) {
    const hit = logsByDate.get(date) === true;
    if (hit) {
      run += 1;
      if (run > longest) longest = run;
    } else if (date < today) {
      run = 0;
    }
  }

  let current = 0;
  for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
    const date = sortedDates[i];
    if (date > today) continue;
    const hit = logsByDate.get(date) === true;
    if (hit) current += 1;
    else if (date < today) break;
  }
  return { current, longest };
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayOfWeekAverages(data: AppData, dates: string[]) {
  const buckets: Array<{ total: number; count: number }> = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  dates.forEach((date) => {
    const score = scoreForDate(data, date);
    if (score.possible === 0) return;
    const dow = new Date(`${date}T00:00:00`).getDay();
    buckets[dow].total += score.finalPercent;
    buckets[dow].count += 1;
  });
  // Reorder Mon..Sun for display.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => ({
    label: dayLabels[dow],
    avg: buckets[dow].count ? Math.round(buckets[dow].total / buckets[dow].count) : 0,
    count: buckets[dow].count,
  }));
}
