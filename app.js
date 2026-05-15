(function () {
  "use strict";

  const STORAGE_KEY = "habit-command-center-v1";
  const MS_DAY = 24 * 60 * 60 * 1000;
  const colors = ["#21715d", "#315f9a", "#b94f2d", "#8a6b18", "#6f4aa3", "#417b72", "#9b3d55", "#5d7132"];
  const priorityWeights = { low: 1, normal: 2, high: 3, critical: 5 };
  const priorityLabels = { low: "Low", normal: "Normal", high: "High", critical: "Critical" };
  const statusLabels = {
    pending: "Pending",
    complete: "Complete",
    missed: "Missed",
    not_started: "Not started",
    in_progress: "In progress",
    done: "Done",
    paused: "Paused",
  };
  const itemTypeLabels = { done: "Done", count: "Count", hours: "Hours" };
  const viewTitles = {
    dashboard: "Dashboard",
    today: "Today",
    planner: "Weekly Planner",
    tasks: "Tasks",
    settings: "Settings",
  };

  let state = loadState();
  let activeView = "dashboard";
  let activeDate = todayIso();

  const els = {
    activeDate: document.getElementById("activeDate"),
    todayLabel: document.getElementById("todayLabel"),
    viewTitle: document.getElementById("viewTitle"),
    toast: document.getElementById("toast"),
  };

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function todayIso() {
    const d = new Date();
    return toIsoDate(d);
  }

  function toIsoDate(date) {
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, "0");
    const d = String(local.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseIso(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, days) {
    const d = parseIso(iso);
    d.setDate(d.getDate() + days);
    return toIsoDate(d);
  }

  function startOfWeek(iso) {
    const d = parseIso(iso);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return toIsoDate(d);
  }

  function sameMonth(dateIso, selectedIso) {
    return dateIso.slice(0, 7) === selectedIso.slice(0, 7);
  }

  function formatDate(iso) {
    return parseIso(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function dayName(iso) {
    return parseIso(iso).toLocaleDateString(undefined, { weekday: "short" });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadState() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn(error);
      }
    }
    const seeded = createSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function createSeedState() {
    const categories = [
      { id: "cat-career", name: "Career", color: "#21715d", sort_order: 1 },
      { id: "cat-study", name: "Study", color: "#315f9a", sort_order: 2 },
      { id: "cat-health", name: "Health", color: "#b94f2d", sort_order: 3 },
      { id: "cat-projects", name: "Projects", color: "#8a6b18", sort_order: 4 },
      { id: "cat-reading", name: "Reading", color: "#6f4aa3", sort_order: 5 },
      { id: "cat-network", name: "Network", color: "#417b72", sort_order: 6 },
      { id: "cat-finance", name: "Finance", color: "#9b3d55", sort_order: 7 },
    ];

    const now = new Date().toISOString();
    const items = [
      item("wake", "Wake 6 AM", "cat-health", "done", 1, "done", "normal", now),
      item("meditation", "Meditation", "cat-health", "done", 1, "done", "normal", now),
      item("gym", "Gym", "cat-health", "hours", 2, "h", "high", now),
      item("sleep", "Wind down + sleep <=11", "cat-health", "done", 1, "done", "normal", now),
      item("dsa", "DSA", "cat-study", "hours", 3, "h", "critical", now),
      item("neetcode", "NeetCode", "cat-study", "count", 2, "q", "high", now),
      item("frontend", "Frontend Questions", "cat-study", "count", 1, "q", "normal", now),
      item("lab", "Lab/Startup", "cat-career", "hours", 2, "h", "high", now),
      item("jobapps", "Job Applications", "cat-career", "count", 4, "apps", "critical", now),
      item("linkedin", "LinkedIn DMs", "cat-network", "count", 2, "msgs", "high", now),
      item("system", "System Design", "cat-study", "hours", 1.5, "h", "high", now),
      item("project5", "Project #5", "cat-projects", "hours", 2, "h", "high", now),
      item("buildempty", "Build From Empty", "cat-projects", "done", 1, "done", "normal", now),
      item("ddia", "DDIA Pages", "cat-reading", "count", 5, "pages", "normal", now),
      item("investing", "Investing", "cat-finance", "hours", 1, "h", "low", now),
      item("coffee", "Coffee Chat", "cat-network", "done", 1, "done", "normal", now),
    ];

    const plans = [];
    const logs = [];
    const start = "2026-05-04";
    for (let i = 0; i < 98; i += 1) {
      const date = addDays(start, i);
      items.forEach((it) => {
        plans.push({
          id: uid("plan"),
          date,
          item_id: it.id,
          task_id: null,
          scheduled: isDefaultScheduled(it, date),
          target: it.default_target,
          source: "imported",
        });
      });
    }

    seedLog(logs, "2026-05-08", "wake", 1, "complete", false, "");
    seedLog(logs, "2026-05-08", "meditation", 1, "complete", false, "");
    seedLog(logs, "2026-05-08", "gym", 2, "complete", false, "");
    seedLog(logs, "2026-05-08", "sleep", 1, "complete", false, "");
    seedLog(logs, "2026-05-08", "dsa", 2, "complete", false, "");
    seedLog(logs, "2026-05-08", "neetcode", 2, "complete", false, "");
    seedLog(logs, "2026-05-08", "frontend", 0, "missed", false, "");
    seedLog(logs, "2026-05-08", "lab", 1, "complete", false, "");
    seedLog(logs, "2026-05-08", "jobapps", 2, "complete", false, "");
    seedLog(logs, "2026-05-09", "gym", 0, "missed", false, "");
    seedLog(logs, "2026-05-09", "sleep", 1, "complete", false, "");
    seedLog(logs, "2026-05-09", "lab", 3, "complete", false, "");
    seedLog(logs, "2026-05-09", "jobapps", 4, "complete", false, "");
    seedLog(logs, "2026-05-10", "wake", 1, "complete", false, "");
    seedLog(logs, "2026-05-10", "sleep", 1, "complete", false, "");
    seedLog(logs, "2026-05-10", "dsa", 1, "complete", false, "");
    seedLog(logs, "2026-05-10", "neetcode", 1, "complete", false, "");
    seedLog(logs, "2026-05-10", "frontend", 1, "complete", false, "");
    seedLog(logs, "2026-05-10", "lab", 3, "complete", false, "");
    seedLog(logs, "2026-05-10", "linkedin", 1, "complete", false, "");
    seedLog(logs, "2026-05-11", "wake", 0, "missed", false, "");
    seedLog(logs, "2026-05-11", "meditation", 0, "missed", false, "");
    seedLog(logs, "2026-05-11", "gym", 2, "complete", false, "");
    seedLog(logs, "2026-05-11", "sleep", 1, "complete", false, "");
    seedLog(logs, "2026-05-11", "dsa", 1.5, "complete", false, "");
    seedLog(logs, "2026-05-11", "neetcode", 1, "complete", false, "");
    seedLog(logs, "2026-05-11", "jobapps", 2, "complete", false, "");
    seedLog(logs, "2026-05-11", "project5", 2, "complete", false, "");
    seedLog(logs, "2026-05-11", "investing", 1, "complete", true, "Investing video watched.");
    seedLog(logs, "2026-05-12", "wake", 0, "missed", false, "");
    seedLog(logs, "2026-05-12", "meditation", 0, "missed", false, "");
    seedLog(logs, "2026-05-12", "gym", 2, "complete", false, "");
    seedLog(logs, "2026-05-12", "sleep", 0, "missed", false, "");

    const tasks = [
      task("APPLY TO COMPOSIO", "high", "not_started", "2026-05-11", "2026-05-13", ""),
      task("REQUEST FOR REFERALL COMPOSIO", "high", "not_started", "2026-05-11", "2026-05-17", ""),
      task("FINISH DUE DILLEGENCE", "normal", "not_started", "2026-05-11", "2026-05-17", ""),
      task("New Portfolio website", "normal", "not_started", "2026-05-11", "2026-05-24", "Add 639 projects, IDD app images, and related assets."),
    ];

    return {
      categories,
      items,
      tasks,
      plans,
      logs,
      weeklyNotes: [
        {
          id: uid("note"),
          week_start_date: "2026-05-11",
          body: "Imported from TODOWEEK2. Refine the weekly plan and schedule tasks that should affect scoring.",
          updated_at: now,
        },
      ],
      meta: { created_at: now, seeded_from: "Vibhrav_Daily_Routine_v3.xlsx" },
    };
  }

  function item(id, name, category_id, tracking_type, default_target, unit, priority, now) {
    return { id, name, category_id, tracking_type, default_target, unit, priority, active: true, created_at: now, updated_at: now };
  }

  function task(title, priority, status, start_date, deadline_date, notes) {
    const now = new Date().toISOString();
    return {
      id: uid("task"),
      title,
      category_id: "cat-career",
      linked_item_id: null,
      priority: priority === "mid" ? "normal" : priority,
      status,
      start_date,
      deadline_date,
      notes,
      created_at: now,
      updated_at: now,
    };
  }

  function isDefaultScheduled(it, date) {
    const d = parseIso(date).getDay();
    if (["investing", "coffee", "ddia", "buildempty"].includes(it.id)) return d === 1 || d === 3 || d === 5;
    if (it.id === "gym") return d !== 0;
    return true;
  }

  function seedLog(logs, date, item_id, actual_value, status, is_extra, notes) {
    logs.push({
      id: uid("log"),
      date,
      item_id,
      task_id: null,
      actual_value,
      status,
      is_extra,
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  function categoryById(id) {
    return state.categories.find((c) => c.id === id);
  }

  function itemById(id) {
    return state.items.find((i) => i.id === id);
  }

  function taskById(id) {
    return state.tasks.find((t) => t.id === id);
  }

  function planFor(date, itemId, taskId) {
    return state.plans.find((p) => p.date === date && (itemId ? p.item_id === itemId : p.task_id === taskId));
  }

  function logFor(date, itemId, taskId, isExtra) {
    return state.logs.find(
      (l) => l.date === date && (itemId ? l.item_id === itemId : l.task_id === taskId) && Boolean(l.is_extra) === Boolean(isExtra),
    );
  }

  function ensurePlan(date, itemId, taskId, target, source) {
    let plan = planFor(date, itemId, taskId);
    if (!plan) {
      plan = { id: uid("plan"), date, item_id: itemId || null, task_id: taskId || null, scheduled: true, target, source };
      state.plans.push(plan);
    }
    return plan;
  }

  function upsertLog(date, itemId, taskId, actualValue, status, isExtra, notes) {
    let log = logFor(date, itemId, taskId, isExtra);
    const now = new Date().toISOString();
    if (!log) {
      log = {
        id: uid("log"),
        date,
        item_id: itemId || null,
        task_id: taskId || null,
        actual_value: actualValue,
        status,
        is_extra: Boolean(isExtra),
        notes: notes || "",
        created_at: now,
        updated_at: now,
      };
      state.logs.push(log);
    } else {
      log.actual_value = actualValue;
      log.status = status;
      log.notes = notes ?? log.notes;
      log.updated_at = now;
    }
    saveState();
  }

  function itemScore(item, actual, status, date) {
    if (status === "pending" && date < todayIso()) return 0;
    if (status === "pending") return null;
    if (status === "missed") return 0;
    if (item.tracking_type === "done") return status === "complete" ? 1 : 0;
    return Math.max(0, Math.min(Number(actual || 0) / Number(item.default_target || 1), 1));
  }

  function scoreForDate(date) {
    const rows = [];
    const scheduledPlans = state.plans.filter((p) => p.date === date && p.scheduled);
    let earned = 0;
    let possible = 0;
    let pending = 0;

    scheduledPlans.forEach((plan) => {
      const entity = plan.item_id ? itemById(plan.item_id) : taskById(plan.task_id);
      if (!entity) return;
      const tracking = plan.item_id ? entity.tracking_type : "done";
      const itemLike = plan.item_id
        ? entity
        : { tracking_type: "done", default_target: 1, priority: entity.priority, name: entity.title };
      const log = logFor(date, plan.item_id, plan.task_id, false);
      const status = log ? log.status : date < todayIso() ? "missed" : "pending";
      const score = itemScore({ ...itemLike, default_target: plan.target || itemLike.default_target }, log?.actual_value, status, date);
      const weight = priorityWeights[itemLike.priority] || 2;
      possible += weight;
      if (score === null) pending += 1;
      else earned += score * weight;
      rows.push({ plan, entity, log, status, score, weight, tracking });
    });

    const plannedPercent = possible ? Math.round((earned / possible) * 100) : 0;
    const extraLogs = state.logs.filter((l) => l.date === date && l.is_extra);
    const extraUnits = extraLogs.reduce((sum, l) => sum + Number(l.actual_value || 0), 0);
    const bonus = Math.min(5, Math.round(extraUnits * 2));
    const finalPercent = Math.min(100, plannedPercent + bonus);
    return { date, rows, earned, possible, pending, plannedPercent, bonus, finalPercent, letter: letterGrade(finalPercent) };
  }

  function letterGrade(score) {
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

  function aggregateScores(dates) {
    const scored = dates.map(scoreForDate).filter((s) => s.possible > 0);
    const avg = scored.length ? Math.round(scored.reduce((sum, s) => sum + s.finalPercent, 0) / scored.length) : 0;
    return { avg, letter: letterGrade(avg), count: scored.length };
  }

  function dateRange(start, days) {
    return Array.from({ length: days }, (_, i) => addDays(start, i));
  }

  function monthDates(selectedIso) {
    const first = `${selectedIso.slice(0, 7)}-01`;
    const d = parseIso(first);
    const out = [];
    while (toIsoDate(d).slice(0, 7) === selectedIso.slice(0, 7)) {
      out.push(toIsoDate(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function totalHoursByCategory(dates) {
    const totals = {};
    state.logs
      .filter((l) => dates.includes(l.date))
      .forEach((log) => {
        const it = itemById(log.item_id);
        if (!it || it.tracking_type !== "hours") return;
        const cat = categoryById(it.category_id);
        const key = cat?.name || "Uncategorized";
        totals[key] = (totals[key] || 0) + Number(log.actual_value || 0);
      });
    return totals;
  }

  function taskStatus(task) {
    if (task.status === "done") return { label: "Done", className: "ok" };
    if (task.deadline_date < todayIso()) return { label: "Overdue", className: "danger" };
    const days = Math.ceil((parseIso(task.deadline_date) - parseIso(todayIso())) / MS_DAY);
    if (days <= 3) return { label: "Due soon", className: "warn" };
    return { label: statusLabels[task.status], className: "" };
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    window.setTimeout(() => els.toast.classList.remove("visible"), 2200);
  }

  function render() {
    els.activeDate.value = activeDate;
    els.todayLabel.textContent = formatDate(activeDate);
    els.viewTitle.textContent = viewTitles[activeView];
    renderDashboard();
    renderToday();
    renderPlanner();
    renderTasks();
    renderSettings();
  }

  function renderDashboard() {
    const week = dateRange(startOfWeek(activeDate), 7);
    const month = monthDates(activeDate);
    const dayScore = scoreForDate(activeDate);
    const weekScore = aggregateScores(week);
    const monthScore = aggregateScores(month);
    const monthHours = totalHoursByCategory(month);
    const weekHours = totalHoursByCategory(week);
    const tasks = state.tasks;
    const overdue = tasks.filter((t) => t.status !== "done" && t.deadline_date < todayIso()).length;
    const dueSoon = tasks.filter((t) => t.status !== "done" && t.deadline_date >= todayIso() && t.deadline_date <= addDays(todayIso(), 7)).length;

    document.getElementById("dashboard").innerHTML = `
      <div class="grid cols-4">
        ${metric("Day grade", `${dayScore.finalPercent}%`, dayScore.letter, dayScore.finalPercent)}
        ${metric("Week grade", `${weekScore.avg}%`, weekScore.letter, weekScore.avg)}
        ${metric("Month grade", `${monthScore.avg}%`, monthScore.letter, monthScore.avg)}
        ${metric("Task risk", `${overdue}/${dueSoon}`, "overdue / due soon", Math.min(100, overdue * 35 + dueSoon * 12))}
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="panel">
          <div class="section-title"><h3>Calendar Heatmap</h3><span class="muted">${activeDate.slice(0, 7)}</span></div>
          <div class="heatmap">
            ${month.map((d) => heatCell(d, scoreForDate(d))).join("")}
          </div>
        </div>
        <div class="panel">
          <div class="section-title"><h3>Hours by Category</h3><span class="muted">This month</span></div>
          ${pieChart(monthHours)}
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="panel">
          <div class="section-title"><h3>Weekly Hours</h3><span class="muted">${formatDate(week[0])} - ${formatDate(week[6])}</span></div>
          ${barChart(weekHours, "h")}
        </div>
        <div class="panel">
          <div class="section-title"><h3>Score Drivers</h3><span class="muted">Selected day</span></div>
          ${scoreDriverTable(dayScore)}
        </div>
      </div>
    `;
  }

  function metric(label, value, hint, pct) {
    return `
      <div class="panel metric">
        <span>${label}</span>
        <strong>${value}</strong>
        <div>
          <div class="score-line"><div class="score-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>
          <span>${hint}</span>
        </div>
      </div>
    `;
  }

  function heatCell(date, score) {
    const opacity = score.possible ? Math.max(0.12, score.finalPercent / 100) : 0.08;
    return `
      <button class="heat-cell" data-action="set-date" data-date="${date}" style="background:rgba(33,113,93,${opacity})">
        <strong>${parseIso(date).getDate()}</strong><br />${score.possible ? `${score.finalPercent}%` : "No plan"}
      </button>
    `;
  }

  function pieChart(values) {
    const entries = Object.entries(values).filter(([, value]) => value > 0);
    if (!entries.length) return `<p class="muted">No logged hours in this range yet.</p>`;
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    let start = 0;
    const gradient = entries
      .map(([name, value], index) => {
        const end = start + (value / total) * 100;
        const segment = `${colors[index % colors.length]} ${start}% ${end}%`;
        start = end;
        return segment;
      })
      .join(", ");
    return `
      <div class="pie-wrap">
        <div class="pie" style="background:conic-gradient(${gradient})"></div>
        <div class="legend">
          ${entries
            .map(
              ([name, value], index) => `
              <div class="legend-item"><span class="swatch" style="background:${colors[index % colors.length]}"></span>${escapeHtml(name)}: ${value.toFixed(1)}h</div>
            `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function barChart(values, unit) {
    const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `<p class="muted">No data yet.</p>`;
    const max = Math.max(...entries.map(([, value]) => value), 1);
    return entries
      .map(
        ([name, value]) => `
        <div class="bar-row">
          <strong>${escapeHtml(name)}</strong>
          <div class="bar-track"><div class="bar" style="width:${(value / max) * 100}%"></div></div>
          <span>${value.toFixed(1)}${unit}</span>
        </div>
      `,
      )
      .join("");
  }

  function scoreDriverTable(score) {
    if (!score.rows.length) return `<p class="muted">No scheduled items for this day.</p>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Status</th><th>Weight</th><th>Score</th></tr></thead>
          <tbody>
            ${score.rows
              .sort((a, b) => b.weight - a.weight)
              .map((row) => {
                const name = row.plan.item_id ? row.entity.name : row.entity.title;
                const pct = row.score === null ? "Pending" : `${Math.round(row.score * 100)}%`;
                return `<tr><td>${escapeHtml(name)}</td><td>${statusPill(row.status)}</td><td>${row.weight}</td><td>${pct}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function statusPill(status) {
    const cls = status === "complete" || status === "done" ? "ok" : status === "missed" ? "danger" : status === "pending" ? "warn" : "";
    return `<span class="status-pill ${cls}">${escapeHtml(statusLabels[status] || status)}</span>`;
  }

  function renderToday() {
    const score = scoreForDate(activeDate);
    const dueTasks = state.tasks
      .filter((t) => t.status !== "done" && t.start_date <= activeDate && t.deadline_date >= activeDate)
      .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
    const extraLogs = state.logs.filter((l) => l.date === activeDate && l.is_extra);

    document.getElementById("today").innerHTML = `
      <div class="grid cols-3">
        ${metric("Today", `${score.finalPercent}%`, `${score.letter} with ${score.bonus}% bonus`, score.finalPercent)}
        ${metric("Planned", `${score.plannedPercent}%`, `${score.pending} pending`, score.plannedPercent)}
        ${metric("Extra credit", `+${score.bonus}%`, "5% daily cap", score.bonus * 20)}
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="section-title"><h3>Log Scheduled Work</h3><span class="muted">${formatDate(activeDate)}</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Type</th><th>Target</th><th>Actual</th><th>Status</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${score.rows.map(todayLogRow).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="panel">
          <div class="section-title"><h3>Add Extra Work</h3><span class="muted">Unscheduled bonus</span></div>
          ${extraWorkForm()}
          <div style="margin-top:14px">${extraLogs.map(extraLogRow).join("") || `<p class="muted">No extra work logged today.</p>`}</div>
        </div>
        <div class="panel">
          <div class="section-title"><h3>Active Tasks</h3><span class="muted">Start date through deadline</span></div>
          ${dueTasks.map(taskMiniRow).join("") || `<p class="muted">No active tasks for this date.</p>`}
        </div>
      </div>
    `;
  }

  function todayLogRow(row) {
    const entity = row.entity;
    const name = row.plan.item_id ? entity.name : entity.title;
    const tracking = row.tracking;
    const target = row.plan.target || 1;
    const actual = row.log?.actual_value ?? "";
    const notes = row.log?.notes ?? "";
    return `
      <tr>
        <td><strong>${escapeHtml(name)}</strong><br /><span class="muted">${row.plan.item_id ? priorityLabels[entity.priority] : "Task"} weight ${row.weight}</span></td>
        <td>${escapeHtml(itemTypeLabels[tracking] || "Done")}</td>
        <td>${target}</td>
        <td><input type="number" min="0" step="0.25" value="${actual}" data-log-actual="${row.plan.id}" ${tracking === "done" ? "disabled" : ""} /></td>
        <td>
          <select data-log-status="${row.plan.id}">
            ${["pending", "complete", "missed"].map((s) => `<option value="${s}" ${row.status === s ? "selected" : ""}>${statusLabels[s]}</option>`).join("")}
          </select>
        </td>
        <td><input type="text" value="${escapeHtml(notes)}" data-log-notes="${row.plan.id}" placeholder="Optional note" /></td>
        <td><button class="small-button" data-action="save-log" data-plan="${row.plan.id}">Save</button></td>
      </tr>
    `;
  }

  function extraWorkForm() {
    return `
      <div class="form-row compact">
        <div class="field">
          <label>Item</label>
          <select id="extraItem">
            ${state.items.filter((i) => i.active).map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Actual</label><input id="extraActual" type="number" min="0" step="0.25" value="1" /></div>
        <div class="field">
          <label>Status</label>
          <select id="extraStatus"><option value="complete">Complete</option><option value="missed">Missed</option></select>
        </div>
        <div class="field"><label>Note</label><input id="extraNote" type="text" /></div>
        <button class="primary" data-action="add-extra">Add</button>
      </div>
    `;
  }

  function extraLogRow(log) {
    const it = itemById(log.item_id);
    return `<div class="card"><strong>${escapeHtml(it?.name || "Extra")}</strong> ${Number(log.actual_value || 0)} ${escapeHtml(it?.unit || "")}<br /><span class="muted">${escapeHtml(log.notes || "No note")}</span></div>`;
  }

  function taskMiniRow(task) {
    const status = taskStatus(task);
    return `<div class="card"><strong>${escapeHtml(task.title)}</strong><br /><span class="muted">${formatDate(task.start_date)} - ${formatDate(task.deadline_date)}</span> <span class="status-pill ${status.className}">${status.label}</span></div>`;
  }

  function renderPlanner() {
    const weekStart = startOfWeek(activeDate);
    const days = dateRange(weekStart, 7);
    const note = state.weeklyNotes.find((n) => n.week_start_date === weekStart);
    const activeItems = state.items.filter((i) => i.active);

    document.getElementById("planner").innerHTML = `
      <div class="panel">
        <div class="section-title">
          <h3>${formatDate(days[0])} - ${formatDate(days[6])}</h3>
          <div><button class="secondary" data-action="copy-previous-week">Copy previous week</button></div>
        </div>
        <div class="table-wrap">
          <table class="planner-grid">
            <thead>
              <tr><th>Item</th>${days.map((d) => `<th>${dayName(d)}<br />${formatDate(d).replace(", 2026", "")}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${activeItems.map((it) => plannerItemRow(it, days)).join("")}
              ${state.tasks.map((task) => plannerTaskRow(task, days)).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="section-title"><h3>Weekly Notes</h3><span class="muted">Freeform</span></div>
        <textarea id="weeklyNote">${escapeHtml(note?.body || "")}</textarea>
        <div style="margin-top:10px"><button class="primary" data-action="save-weekly-note" data-week="${weekStart}">Save notes</button></div>
      </div>
    `;
  }

  function plannerItemRow(item, days) {
    return `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong><br /><span class="muted">${priorityLabels[item.priority]} / ${item.default_target} ${escapeHtml(item.unit)}</span></td>
        ${days
          .map((date) => {
            const plan = ensurePlan(date, item.id, null, item.default_target, "weekly_plan");
            return `
              <td>
                <label><input type="checkbox" data-action="toggle-plan" data-plan="${plan.id}" ${plan.scheduled ? "checked" : ""} /> Scheduled</label>
                <input type="number" min="0" step="0.25" value="${plan.target ?? item.default_target}" data-action="target-plan" data-plan="${plan.id}" />
              </td>`;
          })
          .join("")}
      </tr>
    `;
  }

  function plannerTaskRow(task, days) {
    return `
      <tr>
        <td><strong>${escapeHtml(task.title)}</strong><br /><span class="muted">Task / ${formatDate(task.deadline_date)}</span></td>
        ${days
          .map((date) => {
            const plan = planFor(date, null, task.id);
            return `
              <td>
                <label><input type="checkbox" data-action="toggle-task-plan" data-task="${task.id}" data-date="${date}" ${plan?.scheduled ? "checked" : ""} /> Score task</label>
              </td>`;
          })
          .join("")}
      </tr>
    `;
  }

  function renderTasks() {
    const filter = document.getElementById("taskFilter")?.value || "active";
    const filtered = filterTasks(filter);
    document.getElementById("tasks").innerHTML = `
      <div class="panel">
        <div class="section-title"><h3>Create Task</h3><span class="muted">Start and deadline are required</span></div>
        <div class="form-row">
          <div class="field"><label>Task</label><input id="taskTitle" placeholder="Task title" /></div>
          <div class="field"><label>Priority</label><select id="taskPriority">${priorityOptions("normal")}</select></div>
          <div class="field"><label>Start date</label><input id="taskStart" type="date" value="${activeDate}" /></div>
          <div class="field"><label>Deadline</label><input id="taskDeadline" type="date" value="${addDays(activeDate, 7)}" /></div>
        </div>
        <div class="form-row" style="margin-top:10px">
          <div class="field"><label>Status</label><select id="taskStatus">${taskStatusOptions("not_started")}</select></div>
          <div class="field"><label>Category</label><select id="taskCategory">${categoryOptions("cat-career")}</select></div>
          <div class="field"><label>Linked item</label><select id="taskLinked">${linkedItemOptions("")}</select></div>
          <div class="field"><label>Notes</label><input id="taskNotes" /></div>
        </div>
        <div style="margin-top:10px"><button class="primary" data-action="create-task">Create task</button></div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="section-title">
          <h3>Tasks</h3>
          <select id="taskFilter" data-action="task-filter">
            ${["active", "overdue", "due_week", "completed", "all"].map((f) => `<option value="${f}" ${filter === f ? "selected" : ""}>${filterLabel(f)}</option>`).join("")}
          </select>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Start</th><th>Deadline</th><th>Notes</th><th></th></tr></thead>
            <tbody>${filtered.map(taskTableRow).join("") || `<tr><td colspan="7">No tasks for this filter.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function filterTasks(filter) {
    return state.tasks.filter((task) => {
      if (filter === "all") return true;
      if (filter === "completed") return task.status === "done";
      if (filter === "overdue") return task.status !== "done" && task.deadline_date < todayIso();
      if (filter === "due_week") return task.status !== "done" && task.deadline_date >= todayIso() && task.deadline_date <= addDays(todayIso(), 7);
      return task.status !== "done";
    });
  }

  function filterLabel(filter) {
    return { active: "Active", overdue: "Overdue", due_week: "Due this week", completed: "Completed", all: "All" }[filter];
  }

  function taskTableRow(task) {
    const risk = taskStatus(task);
    return `
      <tr>
        <td><input value="${escapeHtml(task.title)}" data-task-field="${task.id}:title" /></td>
        <td><select data-task-field="${task.id}:priority">${priorityOptions(task.priority)}</select></td>
        <td><select data-task-field="${task.id}:status">${taskStatusOptions(task.status)}</select><br /><span class="status-pill ${risk.className}">${risk.label}</span></td>
        <td><input type="date" value="${task.start_date}" data-task-field="${task.id}:start_date" /></td>
        <td><input type="date" value="${task.deadline_date}" data-task-field="${task.id}:deadline_date" /></td>
        <td><input value="${escapeHtml(task.notes || "")}" data-task-field="${task.id}:notes" /></td>
        <td><button class="small-button" data-action="save-task" data-task="${task.id}">Save</button></td>
      </tr>
    `;
  }

  function renderSettings() {
    document.getElementById("settings").innerHTML = `
      <div class="grid cols-2">
        <div class="panel">
          <div class="section-title"><h3>Add Trackable Item</h3><span class="muted">Dynamic scoring</span></div>
          <div class="form-row">
            <div class="field"><label>Name</label><input id="itemName" /></div>
            <div class="field"><label>Category</label><select id="itemCategory">${categoryOptions(state.categories[0]?.id)}</select></div>
            <div class="field"><label>Type</label><select id="itemType"><option value="done">Done</option><option value="count">Count</option><option value="hours">Hours</option></select></div>
            <div class="field"><label>Priority</label><select id="itemPriority">${priorityOptions("normal")}</select></div>
          </div>
          <div class="form-row" style="margin-top:10px">
            <div class="field"><label>Default target</label><input id="itemTarget" type="number" min="0" step="0.25" value="1" /></div>
            <div class="field"><label>Unit</label><input id="itemUnit" value="done" /></div>
            <div class="field"><label>Active</label><select id="itemActive"><option value="true">Active</option><option value="false">Inactive</option></select></div>
            <div class="field"><label>&nbsp;</label><button class="primary" data-action="create-item">Create item</button></div>
          </div>
        </div>

        <div class="panel">
          <div class="section-title"><h3>Backup</h3><span class="muted">CSV / JSON</span></div>
          <div class="grid">
            <button class="secondary" data-action="export-json">Export JSON</button>
            <button class="secondary" data-action="export-csv">Export CSV bundle</button>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="section-title"><h3>Trackable Items</h3><span class="muted">New items join scoring when scheduled</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Category</th><th>Type</th><th>Target</th><th>Unit</th><th>Priority</th><th>Active</th><th></th></tr></thead>
            <tbody>${state.items.map(itemTableRow).join("")}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function itemTableRow(item) {
    return `
      <tr>
        <td><input value="${escapeHtml(item.name)}" data-item-field="${item.id}:name" /></td>
        <td><select data-item-field="${item.id}:category_id">${categoryOptions(item.category_id)}</select></td>
        <td><select data-item-field="${item.id}:tracking_type">${["done", "count", "hours"].map((t) => `<option value="${t}" ${item.tracking_type === t ? "selected" : ""}>${itemTypeLabels[t]}</option>`).join("")}</select></td>
        <td><input type="number" min="0" step="0.25" value="${item.default_target}" data-item-field="${item.id}:default_target" /></td>
        <td><input value="${escapeHtml(item.unit)}" data-item-field="${item.id}:unit" /></td>
        <td><select data-item-field="${item.id}:priority">${priorityOptions(item.priority)}</select></td>
        <td><select data-item-field="${item.id}:active"><option value="true" ${item.active ? "selected" : ""}>Active</option><option value="false" ${!item.active ? "selected" : ""}>Inactive</option></select></td>
        <td><button class="small-button" data-action="save-item" data-item="${item.id}">Save</button></td>
      </tr>
    `;
  }

  function priorityOptions(selected) {
    return Object.keys(priorityWeights).map((p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${priorityLabels[p]}</option>`).join("");
  }

  function taskStatusOptions(selected) {
    return ["not_started", "in_progress", "done", "paused"].map((s) => `<option value="${s}" ${selected === s ? "selected" : ""}>${statusLabels[s]}</option>`).join("");
  }

  function categoryOptions(selected) {
    return state.categories.map((c) => `<option value="${c.id}" ${selected === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
  }

  function linkedItemOptions(selected) {
    return `<option value="">None</option>${state.items.map((i) => `<option value="${i.id}" ${selected === i.id ? "selected" : ""}>${escapeHtml(i.name)}</option>`).join("")}`;
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function toCsv(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    return [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
  }

  function bindEvents() {
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => {
        activeView = button.dataset.view;
        document.querySelectorAll(".nav-button").forEach((b) => b.classList.toggle("active", b === button));
        document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === activeView));
        render();
      });
    });

    els.activeDate.addEventListener("change", (event) => {
      activeDate = event.target.value || todayIso();
      render();
    });

    document.getElementById("resetSeed").addEventListener("click", () => {
      if (!confirm("Reset local app data back to the workbook-derived seed?")) return;
      state = createSeedState();
      saveState();
      render();
      showToast("Seed data restored.");
    });

    document.body.addEventListener("change", handleChange);
    document.body.addEventListener("click", handleClick);
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches("[data-action='toggle-plan']")) {
      const plan = state.plans.find((p) => p.id === target.dataset.plan);
      if (plan) plan.scheduled = target.checked;
      saveState();
      render();
    }
    if (target.matches("[data-action='target-plan']")) {
      const plan = state.plans.find((p) => p.id === target.dataset.plan);
      if (plan) plan.target = Number(target.value || 0);
      saveState();
    }
    if (target.matches("[data-action='toggle-task-plan']")) {
      const task = taskById(target.dataset.task);
      if (!task) return;
      const plan = ensurePlan(target.dataset.date, null, task.id, 1, "weekly_plan");
      plan.scheduled = target.checked;
      saveState();
      render();
    }
    if (target.matches("[data-action='task-filter']")) renderTasks();
  }

  function handleClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (!action) return;

    if (action === "set-date") {
      activeDate = button.dataset.date;
      activeView = "today";
      document.querySelectorAll(".nav-button").forEach((b) => b.classList.toggle("active", b.dataset.view === "today"));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "today"));
      render();
    }

    if (action === "save-log") saveScheduledLog(button.dataset.plan);
    if (action === "add-extra") addExtraLog();
    if (action === "save-weekly-note") saveWeeklyNote(button.dataset.week);
    if (action === "copy-previous-week") copyPreviousWeek();
    if (action === "create-task") createTask();
    if (action === "save-task") saveTask(button.dataset.task);
    if (action === "create-item") createItem();
    if (action === "save-item") saveItem(button.dataset.item);
    if (action === "export-json") download(`habit-command-center-${todayIso()}.json`, JSON.stringify(state, null, 2));
    if (action === "export-csv") exportCsvBundle();
  }

  function saveScheduledLog(planId) {
    const plan = state.plans.find((p) => p.id === planId);
    if (!plan) return;
    const status = document.querySelector(`[data-log-status="${planId}"]`).value;
    const notes = document.querySelector(`[data-log-notes="${planId}"]`).value;
    const entity = plan.item_id ? itemById(plan.item_id) : null;
    const actualInput = document.querySelector(`[data-log-actual="${planId}"]`);
    const actual = entity?.tracking_type === "done" || plan.task_id ? (status === "complete" ? 1 : 0) : Number(actualInput.value || 0);
    upsertLog(plan.date, plan.item_id, plan.task_id, actual, status, false, notes);
    showToast("Log saved.");
    render();
  }

  function addExtraLog() {
    const itemId = document.getElementById("extraItem").value;
    const actual = Number(document.getElementById("extraActual").value || 0);
    const status = document.getElementById("extraStatus").value;
    const note = document.getElementById("extraNote").value;
    if (!itemId || actual < 0) return showToast("Choose an item and valid amount.");
    upsertLog(activeDate, itemId, null, actual, status, true, note);
    showToast("Extra work logged.");
    render();
  }

  function saveWeeklyNote(weekStart) {
    let note = state.weeklyNotes.find((n) => n.week_start_date === weekStart);
    if (!note) {
      note = { id: uid("note"), week_start_date: weekStart, body: "", updated_at: new Date().toISOString() };
      state.weeklyNotes.push(note);
    }
    note.body = document.getElementById("weeklyNote").value;
    note.updated_at = new Date().toISOString();
    saveState();
    showToast("Weekly note saved.");
  }

  function copyPreviousWeek() {
    const weekStart = startOfWeek(activeDate);
    const previousStart = addDays(weekStart, -7);
    const days = dateRange(weekStart, 7);
    days.forEach((date, index) => {
      const previousDate = addDays(previousStart, index);
      state.plans
        .filter((p) => p.date === previousDate)
        .forEach((oldPlan) => {
          const plan = ensurePlan(date, oldPlan.item_id, oldPlan.task_id, oldPlan.target, "weekly_plan");
          plan.scheduled = oldPlan.scheduled;
          plan.target = oldPlan.target;
        });
    });
    saveState();
    showToast("Previous week copied.");
    render();
  }

  function createTask() {
    const title = document.getElementById("taskTitle").value.trim();
    const start = document.getElementById("taskStart").value;
    const deadline = document.getElementById("taskDeadline").value;
    if (!title) return showToast("Task title is required.");
    if (!start || !deadline) return showToast("Start date and deadline are required.");
    if (deadline < start) return showToast("Deadline must be on or after start date.");
    const now = new Date().toISOString();
    state.tasks.push({
      id: uid("task"),
      title,
      category_id: document.getElementById("taskCategory").value || null,
      linked_item_id: document.getElementById("taskLinked").value || null,
      priority: document.getElementById("taskPriority").value,
      status: document.getElementById("taskStatus").value,
      start_date: start,
      deadline_date: deadline,
      notes: document.getElementById("taskNotes").value,
      created_at: now,
      updated_at: now,
    });
    saveState();
    showToast("Task created.");
    render();
  }

  function saveTask(taskId) {
    const task = taskById(taskId);
    if (!task) return;
    const fields = {};
    document.querySelectorAll(`[data-task-field^="${taskId}:"]`).forEach((input) => {
      fields[input.dataset.taskField.split(":")[1]] = input.value;
    });
    if (!fields.title.trim()) return showToast("Task title is required.");
    if (!fields.start_date || !fields.deadline_date) return showToast("Start date and deadline are required.");
    if (fields.deadline_date < fields.start_date) return showToast("Deadline must be on or after start date.");
    Object.assign(task, fields, { updated_at: new Date().toISOString() });
    saveState();
    showToast("Task saved.");
    render();
  }

  function createItem() {
    const name = document.getElementById("itemName").value.trim();
    if (!name) return showToast("Item name is required.");
    const now = new Date().toISOString();
    state.items.push({
      id: uid("item"),
      name,
      category_id: document.getElementById("itemCategory").value,
      tracking_type: document.getElementById("itemType").value,
      default_target: Number(document.getElementById("itemTarget").value || 1),
      unit: document.getElementById("itemUnit").value || "unit",
      priority: document.getElementById("itemPriority").value,
      active: document.getElementById("itemActive").value === "true",
      created_at: now,
      updated_at: now,
    });
    saveState();
    showToast("Item created. Schedule it in Planner to affect scoring.");
    render();
  }

  function saveItem(itemId) {
    const it = itemById(itemId);
    if (!it) return;
    const fields = {};
    document.querySelectorAll(`[data-item-field^="${itemId}:"]`).forEach((input) => {
      fields[input.dataset.itemField.split(":")[1]] = input.value;
    });
    fields.default_target = Number(fields.default_target || 1);
    fields.active = fields.active === "true";
    Object.assign(it, fields, { updated_at: new Date().toISOString() });
    saveState();
    showToast("Item saved.");
    render();
  }

  function exportCsvBundle() {
    const bundle = [
      "## categories\n" + toCsv(state.categories),
      "## items\n" + toCsv(state.items),
      "## tasks\n" + toCsv(state.tasks),
      "## plans\n" + toCsv(state.plans),
      "## logs\n" + toCsv(state.logs),
      "## weeklyNotes\n" + toCsv(state.weeklyNotes),
    ].join("\n\n");
    download(`habit-command-center-${todayIso()}.csv`, bundle);
  }

  bindEvents();
  render();
})();
