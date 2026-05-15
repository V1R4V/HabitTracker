"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Moon,
  Plus,
  Save,
  Settings as SettingsIcon,
  Sun,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDays, dateRange, dayName, formatDate, monthDates, startOfWeek, todayIso } from "../lib/date";
import { aggregateScores, priorityWeights, scoreForDate } from "../lib/scoring";
import { buildSeed, itemSeeds, planSeeds, taskSeeds } from "../lib/seed";
import { createClient } from "../lib/supabase/client";
import type { AppData, Category, Item, Log, LogStatus, Plan, Priority, Task, TaskStatus, TrackingType, WeeklyNote } from "../lib/types";

const emptyData: AppData = { categories: [], items: [], tasks: [], plans: [], logs: [], weeklyNotes: [] };
const colors = ["#21715d", "#315f9a", "#b94f2d", "#8a6b18", "#6f4aa3", "#417b72", "#9b3d55"];
const priorityLabels: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", critical: "Critical" };
const statusLabels: Record<string, string> = {
  pending: "Pending",
  complete: "Complete",
  missed: "Missed",
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  paused: "Paused",
};
const navItems = [
  { name: "dashboard", label: "Dashboard", icon: BarChart3 },
  { name: "today", label: "Today", icon: CheckSquare },
  { name: "planner", label: "Planner", icon: CalendarDays },
  { name: "tasks", label: "Tasks", icon: ClipboardList },
  { name: "settings", label: "Settings", icon: SettingsIcon },
];

export default function HabitApp({ userId, userEmail, initialDate }: { userId: string; userEmail: string; initialDate: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setViewState] = useState("dashboard");
  const [activeDate, setActiveDate] = useState(initialDate);
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState("dark");
  const [hydrated, setHydrated] = useState(false);
  const showDateTools = view !== "settings";

  useEffect(() => {
    const saved = window.localStorage.getItem("hcc-theme");
    setTheme(saved || "dark");
    const savedView = window.localStorage.getItem("hcc-view");
    if (savedView && navItems.some((item) => item.name === savedView)) setViewState(savedView);
    setActiveDate(window.localStorage.getItem("hcc-active-date") || todayIso());
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("hcc-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("hcc-view", view);
  }, [hydrated, view]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("hcc-active-date", activeDate);
  }, [activeDate, hydrated]);

  useEffect(() => {
    void loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(seedIfEmpty = false) {
    setLoading(true);
    const [categories, items, tasks, plans, logs, weeklyNotes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("items").select("*").order("name"),
      supabase.from("tasks").select("*").order("deadline_date"),
      supabase.from("plans").select("*").order("date"),
      supabase.from("logs").select("*").order("date"),
      supabase.from("weekly_notes").select("*").order("week_start_date"),
    ]);

    if (categories.error || items.error || tasks.error || plans.error || logs.error || weeklyNotes.error) {
      showToast("Database read failed. Check migration and RLS setup.");
      setLoading(false);
      return;
    }

    if (seedIfEmpty && (categories.data?.length || 0) === 0) {
      await seedDefaultData();
      return loadData(false);
    }

    setData({
      categories: (categories.data || []) as Category[],
      items: (items.data || []) as Item[],
      tasks: (tasks.data || []) as Task[],
      plans: (plans.data || []) as Plan[],
      logs: (logs.data || []) as Log[],
      weeklyNotes: (weeklyNotes.data || []) as WeeklyNote[],
    });
    setLoading(false);
  }

  async function seedDefaultData() {
    const categorySeed = buildSeed(userId).categories;
    const { data: insertedCategories, error: categoryError } = await supabase.from("categories").insert(categorySeed).select("*");
    if (categoryError || !insertedCategories) {
      showToast("Seed failed at categories.");
      setLoading(false);
      return;
    }

    const categoryIds = Object.fromEntries(insertedCategories.map((category) => [category.name, category.id]));
    const { data: insertedItems, error: itemError } = await supabase.from("items").insert(itemSeeds(userId, categoryIds)).select("*");
    if (itemError || !insertedItems) {
      showToast("Seed failed at items.");
      setLoading(false);
      return;
    }

    await supabase.from("tasks").insert(taskSeeds(userId, categoryIds.Career));
    await supabase.from("plans").insert(planSeeds(userId, insertedItems as Item[]));
    await supabase.from("weekly_notes").insert({
      user_id: userId,
      week_start_date: "2026-05-11",
      body: "Imported starter week. Refine this plan and schedule tasks that should affect scoring.",
    });
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function setView(nextView: string) {
    setViewState(nextView);
    if (hydrated) window.localStorage.setItem("hcc-view", nextView);
  }

  function setPlans(updater: (plans: Plan[]) => Plan[]) {
    setData((current) => ({ ...current, plans: updater(current.plans) }));
  }

  function setLogs(updater: (logs: Log[]) => Log[]) {
    setData((current) => ({ ...current, logs: updater(current.logs) }));
  }

  const week = dateRange(startOfWeek(activeDate), 7);
  const month = monthDates(activeDate);
  const dayScore = scoreForDate(data, activeDate);
  const weekScore = aggregateScores(data, week);
  const monthScore = aggregateScores(data, month);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">HC</div>
          <div>
            <h1>Habit Command Center</h1>
            <p>{userEmail}</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" key={item.name} className={view === item.name ? "active" : ""} onClick={() => setView(item.name)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <button type="button" className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{showDateTools ? formatDate(activeDate) : "Configuration"}</p>
            <h2>{view[0].toUpperCase() + view.slice(1)}</h2>
          </div>
          {showDateTools ? <DateNavigator activeDate={activeDate} view={view} setActiveDate={setActiveDate} /> : null}
        </header>
        {loading ? <div className="panel">Loading private tracker data...</div> : null}
        {!loading && view === "dashboard" ? <Dashboard data={data} activeDate={activeDate} month={month} week={week} dayScore={dayScore} weekScore={weekScore} monthScore={monthScore} setActiveDate={setActiveDate} setView={setView} /> : null}
        {!loading && view === "today" ? <Today data={data} activeDate={activeDate} userId={userId} supabase={supabase} refresh={() => loadData(false)} showToast={showToast} setLogs={setLogs} /> : null}
        {!loading && view === "planner" ? <Planner data={data} week={week} userId={userId} supabase={supabase} refresh={() => loadData(false)} showToast={showToast} setPlans={setPlans} /> : null}
        {!loading && view === "tasks" ? <Tasks data={data} userId={userId} supabase={supabase} refresh={() => loadData(false)} showToast={showToast} /> : null}
        {!loading && view === "settings" ? <Settings data={data} userId={userId} supabase={supabase} refresh={() => loadData(false)} showToast={showToast} /> : null}
      </main>
      {toast ? <div className="toast visible">{toast}</div> : null}
    </div>
  );
}

function Dashboard({
  data,
  activeDate,
  month,
  week,
  dayScore,
  weekScore,
  monthScore,
  setActiveDate,
  setView,
}: {
  data: AppData;
  activeDate: string;
  month: string[];
  week: string[];
  dayScore: ReturnType<typeof scoreForDate>;
  weekScore: ReturnType<typeof aggregateScores>;
  monthScore: ReturnType<typeof aggregateScores>;
  setActiveDate: (date: string) => void;
  setView: (view: string) => void;
}) {
  const monthHours = hoursByCategory(data, month);
  const weekHours = hoursByCategory(data, week);
  const today = dayProgress(dayScore);
  const activeTasks = data.tasks.filter((task) => task.status !== "done" && task.start_date <= activeDate && task.deadline_date >= activeDate);
  const completedTasks = data.tasks.filter((task) => task.status === "done" && task.start_date <= activeDate && task.deadline_date >= activeDate);
  const overdue = data.tasks.filter((task) => task.status !== "done" && task.deadline_date < todayIso()).length;
  const dueSoon = data.tasks.filter((task) => task.status !== "done" && task.deadline_date >= todayIso() && task.deadline_date <= addDays(todayIso(), 7)).length;

  return (
    <div className="grid">
      <section className="today-brief panel">
        <div>
          <p className="eyebrow">Selected day</p>
          <h3>{formatDate(activeDate)}</h3>
        </div>
        <div className="brief-stat">
          <span>Scheduled work</span>
          <strong>{today.complete}/{today.total}</strong>
          <small>{today.pending} pending, {today.missed} missed</small>
        </div>
        <div className="brief-stat">
          <span>Active tasks</span>
          <strong>{completedTasks.length}/{completedTasks.length + activeTasks.length}</strong>
          <small>{activeTasks.length} still open</small>
        </div>
        <button type="button" className="primary" onClick={() => setView("today")}>
          <CheckSquare size={17} aria-hidden="true" />Log today
        </button>
      </section>
      <div className="metric-grid">
        <Metric label="Day grade" value={`${dayScore.finalPercent}%`} detail={dayScore.letter} pct={dayScore.finalPercent} />
        <Metric label="Week grade" value={`${weekScore.avg}%`} detail={weekScore.letter} pct={weekScore.avg} />
        <Metric label="Month grade" value={`${monthScore.avg}%`} detail={monthScore.letter} pct={monthScore.avg} />
        <Metric label="Task risk" value={`${overdue}/${dueSoon}`} detail="overdue / due soon" pct={Math.min(100, overdue * 35 + dueSoon * 12)} />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h3>Calendar Heatmap</h3><span>{activeDate.slice(0, 7)}</span></div>
          <div className="heatmap">
            {month.map((date) => {
              const score = scoreForDate(data, date);
              return (
                <button
                  type="button"
                  key={date}
                  className="heat-cell"
                  style={{ "--heat": heatColor(score.finalPercent, score.possible), "--heat-ink": score.possible ? "#f8fafc" : "var(--muted)" } as CSSProperties}
                  onClick={() => {
                    setActiveDate(date);
                    setView("today");
                  }}
                >
                  <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                  <span>{score.possible ? `${score.finalPercent}%` : "No plan"}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <div className="section-title"><h3>Hours by Category</h3><span>This month</span></div>
          <ChartPie rows={monthHours} />
        </section>
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h3>Weekly Hours</h3><span>{formatDate(week[0])} - {formatDate(week[6])}</span></div>
          <ChartBars rows={weekHours} />
        </section>
        <section className="panel">
          <div className="section-title"><h3>Score Drivers</h3><span>Selected day</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Status</th><th>Weight</th><th>Score</th></tr></thead>
              <tbody>
                {dayScore.rows.sort((a, b) => b.weight - a.weight).map((row) => (
                  <tr key={row.plan.id}>
                    <td>{row.name}</td>
                    <td><span className={`pill ${row.status}`}>{statusLabels[row.status]}</span></td>
                    <td>{row.weight}</td>
                    <td>{row.score === null ? "Pending" : `${Math.round(row.score * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Today({
  data,
  activeDate,
  userId,
  supabase,
  refresh,
  showToast,
  setLogs,
}: CrudProps & { activeDate: string; setLogs: (updater: (logs: Log[]) => Log[]) => void }) {
  const score = scoreForDate(data, activeDate);
  const activeTasks = data.tasks.filter((task) => task.status !== "done" && task.start_date <= activeDate && task.deadline_date >= activeDate);
  const progress = dayProgress(score);

  async function saveLog(plan: Plan, status: LogStatus, actual: number, notes: string) {
    const row = {
      user_id: userId,
      date: plan.date,
      item_id: plan.item_id,
      task_id: plan.task_id,
      actual_value: actual,
      status,
      is_extra: false,
      notes,
    };
    const existing = data.logs.find(
      (log) =>
        log.date === plan.date &&
        log.item_id === plan.item_id &&
        log.task_id === plan.task_id &&
        log.is_extra === false,
    );
    const result = existing
      ? await supabase.from("logs").update({ actual_value: actual, status, notes }).eq("id", existing.id).select("*").single()
      : await supabase.from("logs").insert(row).select("*").single();
    if (result.error) {
      showToast(`Log save failed: ${result.error.message}`);
      return;
    }
    if (result.data) setLogs((current) => upsertLog(current, result.data as Log));
    showToast("Log saved.");
  }

  async function addExtra(formData: FormData) {
    const itemId = String(formData.get("item_id"));
    const item = data.items.find((candidate) => candidate.id === itemId);
    const actual = Number(formData.get("actual_value") || 0);
    if (!item) return showToast("Choose an active item before logging extra work.");
    const { error } = await supabase.from("logs").insert({
      user_id: userId,
      date: activeDate,
      item_id: itemId,
      task_id: null,
      actual_value: actual,
      status: "complete",
      is_extra: true,
      notes: String(formData.get("notes") || ""),
    });
    if (error) return showToast(`Extra work save failed: ${error.message}`);
    showToast(`Extra ${item?.name || "work"} logged.`);
    await refresh();
  }

  return (
    <div className="grid">
      <div className="metric-grid">
        <Metric label="Today" value={`${score.finalPercent}%`} detail={`${score.letter} with ${score.bonus}% bonus`} pct={score.finalPercent} />
        <Metric label="Completed" value={`${progress.complete}/${progress.total}`} detail={`${progress.pending} pending`} pct={progress.total ? (progress.complete / progress.total) * 100 : 0} />
        <Metric label="Planned" value={`${score.plannedPercent}%`} detail={`${progress.missed} missed`} pct={score.plannedPercent} />
        <Metric label="Extra credit" value={`+${score.bonus}%`} detail="5% daily cap" pct={score.bonus * 20} />
      </div>
      <section className="panel">
        <div className="section-title"><h3>Log Scheduled Work</h3><span>{formatDate(activeDate)}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Target</th><th>Actual</th><th>Status</th><th>Notes</th><th></th></tr></thead>
            <tbody>{score.rows.map((row) => <LogRow key={row.plan.id} row={row} saveLog={saveLog} />)}</tbody>
          </table>
        </div>
      </section>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h3>Add Extra Work</h3><span>Unscheduled bonus</span></div>
          <form action={addExtra} className="inline-form">
            <select name="item_id">{data.items.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <input name="actual_value" type="number" min="0" step="0.25" defaultValue="1" />
            <input name="notes" placeholder="Optional note" />
            <button className="primary"><Plus size={17} aria-hidden="true" />Add</button>
          </form>
        </section>
        <section className="panel">
          <div className="section-title"><h3>Active Tasks</h3><span>Start through deadline</span></div>
          {activeTasks.length ? activeTasks.map((task) => <TaskCard key={task.id} task={task} />) : <p className="muted">No active tasks for this date.</p>}
        </section>
      </div>
    </div>
  );
}

function LogRow({
  row,
  saveLog,
}: {
  row: ReturnType<typeof scoreForDate>["rows"][number];
  saveLog: (plan: Plan, status: LogStatus, actual: number, notes: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<LogStatus>(row.status);
  const [actual, setActual] = useState(row.actual || 0);
  const [notes, setNotes] = useState(row.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(row.status);
    setActual(row.actual || 0);
    setNotes(row.notes || "");
  }, [row]);

  async function handleSave() {
    setSaving(true);
    await saveLog(row.plan, status, status === "complete" && row.plan.task_id ? 1 : actual, notes);
    setSaving(false);
  }

  return (
    <tr>
      <td><strong>{row.name}</strong><br /><span className="muted">Weight {row.weight}</span></td>
      <td>{formatPlanTarget(row.plan, row.entity)}</td>
      <td><input type="number" min="0" step="0.25" value={actual} onChange={(event) => setActual(Number(event.target.value))} /></td>
      <td><select value={status} onChange={(event) => setStatus(event.target.value as LogStatus)}><option value="pending">Pending</option><option value="complete">Complete</option><option value="missed">Missed</option></select></td>
      <td><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note" /></td>
      <td><button type="button" className="small-button" disabled={saving} onClick={handleSave}><Save size={15} aria-hidden="true" />{saving ? "Saving" : "Save"}</button></td>
    </tr>
  );
}

function Planner({
  data,
  week,
  userId,
  supabase,
  refresh,
  showToast,
  setPlans,
}: CrudProps & { week: string[]; setPlans: (updater: (plans: Plan[]) => Plan[]) => void }) {
  const weekStart = week[0];
  const note = data.weeklyNotes.find((candidate) => candidate.week_start_date === weekStart);
  const [localPlans, setLocalPlans] = useState(data.plans);
  const [savingPlanKeys, setSavingPlanKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalPlans(data.plans);
  }, [data.plans]);

  function planKey(date: string, id: string) {
    return `${date}:${id}`;
  }

  async function togglePlan(date: string, item: Item, scheduled: boolean) {
    const key = planKey(date, item.id);
    const previousPlans = localPlans;
    const optimisticUpdate = (current: Plan[]) => optimisticPlans(current, { userId, date, itemId: item.id, taskId: null, scheduled, target: item.default_target });
    setSavingPlanKeys((current) => new Set(current).add(key));
    setLocalPlans(optimisticUpdate);
    setPlans(optimisticUpdate);
    const { data: existing, error: lookupError } = await supabase
      .from("plans")
      .select("id,target")
      .eq("user_id", userId)
      .eq("date", date)
      .eq("item_id", item.id)
      .is("task_id", null)
      .maybeSingle();
    if (lookupError) {
      setLocalPlans(previousPlans);
      setPlans(() => previousPlans);
      setSavingPlanKeys((current) => removeFromSet(current, key));
      showToast(`Could not check ${item.name}: ${lookupError.message}`);
      return;
    }
    const result = existing
      ? await supabase.from("plans").update({ scheduled, target: existing.target ?? item.default_target }).eq("id", existing.id).select("*").single()
      : await supabase.from("plans").insert({
          user_id: userId,
          date,
          item_id: item.id,
          task_id: null,
          scheduled,
          target: item.default_target,
          source: "weekly_plan",
        }).select("*").single();
    if (result.error) {
      setLocalPlans(previousPlans);
      setPlans(() => previousPlans);
      setSavingPlanKeys((current) => removeFromSet(current, key));
      showToast(`Could not update ${item.name}: ${result.error.message}`);
      return;
    }
    if (result.data) {
      const savedPlan = result.data as Plan;
      setLocalPlans((current) => upsertPlan(current, savedPlan));
      setPlans((current) => upsertPlan(current, savedPlan));
    }
    setSavingPlanKeys((current) => removeFromSet(current, key));
  }

  async function toggleTaskPlan(date: string, task: Task, scheduled: boolean) {
    const key = planKey(date, task.id);
    const previousPlans = localPlans;
    const optimisticUpdate = (current: Plan[]) => optimisticPlans(current, { userId, date, itemId: null, taskId: task.id, scheduled, target: 1 });
    setSavingPlanKeys((current) => new Set(current).add(key));
    setLocalPlans(optimisticUpdate);
    setPlans(optimisticUpdate);
    const { data: existing, error: lookupError } = await supabase
      .from("plans")
      .select("id")
      .eq("user_id", userId)
      .eq("date", date)
      .eq("task_id", task.id)
      .is("item_id", null)
      .maybeSingle();
    if (lookupError) {
      setLocalPlans(previousPlans);
      setPlans(() => previousPlans);
      setSavingPlanKeys((current) => removeFromSet(current, key));
      showToast(`Could not check ${task.title}: ${lookupError.message}`);
      return;
    }
    const result = existing
      ? await supabase.from("plans").update({ scheduled, target: 1 }).eq("id", existing.id).select("*").single()
      : await supabase.from("plans").insert({
          user_id: userId,
          date,
          item_id: null,
          task_id: task.id,
          scheduled,
          target: 1,
          source: "weekly_plan",
        }).select("*").single();
    if (result.error) {
      setLocalPlans(previousPlans);
      setPlans(() => previousPlans);
      setSavingPlanKeys((current) => removeFromSet(current, key));
      showToast(`Could not update ${task.title}: ${result.error.message}`);
      return;
    }
    if (result.data) {
      const savedPlan = result.data as Plan;
      setLocalPlans((current) => upsertPlan(current, savedPlan));
      setPlans((current) => upsertPlan(current, savedPlan));
    }
    setSavingPlanKeys((current) => removeFromSet(current, key));
  }

  async function saveNote(formData: FormData) {
    const { error } = await supabase.from("weekly_notes").upsert(
      { user_id: userId, week_start_date: weekStart, body: String(formData.get("body") || "") },
      { onConflict: "user_id,week_start_date" },
    );
    if (error) return showToast(`Weekly note save failed: ${error.message}`);
    showToast("Weekly note saved.");
    await refresh();
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="section-title"><h3>{formatDate(week[0])} - {formatDate(week[6])}</h3><span>Schedule items and tasks</span></div>
        <div className="table-wrap">
          <table className="planner-table">
            <thead><tr><th>Item</th>{week.map((date) => <th key={date}>{dayName(date)}<br />{formatDate(date)}</th>)}</tr></thead>
            <tbody>
              {data.items.filter((item) => item.active).map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><br /><span className="muted">{priorityLabels[item.priority]} / {formatItemTarget(item)}</span></td>
                  {week.map((date) => {
                    const plan = localPlans.find((candidate) => candidate.date === date && candidate.item_id === item.id);
                    const key = planKey(date, item.id);
                    return <td key={date}><label className={`plan-check ${savingPlanKeys.has(key) ? "saving" : ""}`}><input type="checkbox" checked={Boolean(plan?.scheduled)} onChange={(event) => togglePlan(date, item, event.target.checked)} /><span /></label></td>;
                  })}
                </tr>
              ))}
              {data.tasks.map((task) => (
                <tr key={task.id}>
                  <td><strong>{task.title}</strong><br /><span className="muted">Task / due {formatDate(task.deadline_date)}</span></td>
                  {week.map((date) => {
                    const plan = localPlans.find((candidate) => candidate.date === date && candidate.task_id === task.id);
                    const key = planKey(date, task.id);
                    return <td key={date}><label className={`plan-check ${savingPlanKeys.has(key) ? "saving" : ""}`}><input type="checkbox" checked={Boolean(plan?.scheduled)} onChange={(event) => toggleTaskPlan(date, task, event.target.checked)} /><span /></label></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-title"><h3>Weekly Notes</h3><span>Freeform</span></div>
        <form action={saveNote}>
          <textarea name="body" defaultValue={note?.body || ""} />
          <button className="primary"><Save size={17} aria-hidden="true" />Save notes</button>
        </form>
      </section>
    </div>
  );
}

function Tasks({ data, userId, supabase, refresh, showToast }: CrudProps) {
  const [filter, setFilter] = useState("active");
  const filtered = data.tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "completed") return task.status === "done";
    if (filter === "overdue") return task.status !== "done" && task.deadline_date < todayIso();
    if (filter === "due_week") return task.status !== "done" && task.deadline_date <= addDays(todayIso(), 7);
    return task.status !== "done";
  });

  async function createTask(formData: FormData) {
    const title = String(formData.get("title") || "").trim();
    const startDate = String(formData.get("start_date") || "");
    const deadlineDate = String(formData.get("deadline_date") || "");
    if (!title || !startDate || !deadlineDate) return showToast("Task title, start date, and deadline are required.");
    if (deadlineDate < startDate) return showToast("Deadline must be on or after start date.");
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title,
      category_id: String(formData.get("category_id") || "") || null,
      linked_item_id: String(formData.get("linked_item_id") || "") || null,
      priority: String(formData.get("priority")) as Priority,
      status: "not_started",
      start_date: startDate,
      deadline_date: deadlineDate,
      notes: String(formData.get("notes") || ""),
    });
    if (error) return showToast(`Task create failed: ${error.message}`);
    showToast("Task created.");
    await refresh();
  }

  async function updateTask(task: Task, patch: Partial<Task>) {
    const next = { ...task, ...patch };
    if (!next.title.trim()) return showToast("Task title is required.");
    if (!next.start_date || !next.deadline_date) return showToast("Start date and deadline are required.");
    if (next.deadline_date < next.start_date) return showToast("Deadline must be on or after start date.");
    const { error } = await supabase
      .from("tasks")
      .update({
        title: next.title,
        priority: next.priority,
        status: next.status,
        start_date: next.start_date,
        deadline_date: next.deadline_date,
        notes: next.notes,
      })
      .eq("id", task.id);
    if (error) return showToast(`Task update failed: ${error.message}`);
    showToast("Task saved.");
    await refresh();
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This also removes its scheduled plan/log rows.`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return showToast(`Task delete failed: ${error.message}`);
    showToast("Task deleted.");
    await refresh();
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="section-title"><h3>Create Task</h3><span>Start and deadline required</span></div>
        <form action={createTask} className="task-form">
          <input name="title" placeholder="Task title" required />
          <select name="priority"><PriorityOptions /></select>
          <input name="start_date" type="date" defaultValue={todayIso()} required />
          <input name="deadline_date" type="date" defaultValue={addDays(todayIso(), 7)} required />
          <select name="category_id"><CategoryOptions categories={data.categories} /></select>
          <select name="linked_item_id"><option value="">No linked item</option>{data.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <input name="notes" placeholder="Notes" />
          <button className="primary"><Plus size={17} aria-hidden="true" />Create</button>
        </form>
      </section>
      <section className="panel">
        <div className="section-title">
          <h3>Tasks</h3>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="active">Active</option><option value="overdue">Overdue</option><option value="due_week">Due this week</option><option value="completed">Completed</option><option value="all">All</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Start</th><th>Deadline</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((task) => (
              <TaskEditRow key={task.id} task={task} updateTask={updateTask} deleteTask={deleteTask} />
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DateNavigator({
  activeDate,
  view,
  setActiveDate,
}: {
  activeDate: string;
  view: string;
  setActiveDate: (date: string) => void;
}) {
  const step = view === "planner" ? 7 : 1;
  const label = view === "planner" ? "Week" : "Day";
  const [calendarOpen, setCalendarOpen] = useState(false);
  const month = monthDates(activeDate);
  return (
    <div className="date-tools" aria-label="Calendar navigation">
      <button type="button" className="secondary" onClick={() => setActiveDate(addDays(activeDate, -step))}>
        <ChevronLeft size={17} aria-hidden="true" />Prev {label}
      </button>
      <button type="button" className="secondary" onClick={() => setActiveDate(todayIso())}>
        Today
      </button>
      <input type="date" value={activeDate} onChange={(event) => setActiveDate(event.target.value)} />
      <div className="calendar-jump">
        <button type="button" className="secondary" onClick={() => setCalendarOpen((open) => !open)}>
          <CalendarDays size={17} aria-hidden="true" />Calendar
        </button>
        {calendarOpen ? (
          <div className="calendar-popover">
            <div className="calendar-popover-head">
              <button type="button" className="small-button" onClick={() => setActiveDate(addDays(activeDate, -30))}><ChevronLeft size={14} aria-hidden="true" /></button>
              <strong>{activeDate.slice(0, 7)}</strong>
              <button type="button" className="small-button" onClick={() => setActiveDate(addDays(activeDate, 30))}><ChevronRight size={14} aria-hidden="true" /></button>
            </div>
            <div className="mini-calendar-grid">
              {month.map((date) => (
                <button
                  type="button"
                  key={date}
                  className={date === activeDate ? "active" : ""}
                  onClick={() => {
                    setActiveDate(date);
                    setCalendarOpen(false);
                  }}
                >
                  {new Date(`${date}T00:00:00`).getDate()}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <button type="button" className="secondary" onClick={() => setActiveDate(addDays(activeDate, step))}>
        Next {label}<ChevronRight size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function TaskEditRow({
  task,
  updateTask,
  deleteTask,
}: {
  task: Task;
  updateTask: (task: Task, patch: Partial<Task>) => Promise<void>;
  deleteTask: (task: Task) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [startDate, setStartDate] = useState(task.start_date);
  const [deadlineDate, setDeadlineDate] = useState(task.deadline_date);
  const [notes, setNotes] = useState(task.notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setPriority(task.priority);
    setStatus(task.status);
    setStartDate(task.start_date);
    setDeadlineDate(task.deadline_date);
    setNotes(task.notes);
  }, [task]);

  async function handleSave() {
    setSaving(true);
    await updateTask(task, { title, priority, status, start_date: startDate, deadline_date: deadlineDate, notes });
    setSaving(false);
  }

  return (
    <tr>
      <td><input value={title} onChange={(event) => setTitle(event.target.value)} /></td>
      <td><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><PriorityOptions /></select></td>
      <td>
        <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="paused">Paused</option>
        </select>
      </td>
      <td><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></td>
      <td><input type="date" value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} /></td>
      <td><input value={notes} onChange={(event) => setNotes(event.target.value)} /></td>
      <td>
        <div className="row-actions">
          <button type="button" className="small-button" disabled={saving} onClick={handleSave}><Save size={15} aria-hidden="true" />{saving ? "Saving" : "Save"}</button>
          <button type="button" className="small-button danger-button" onClick={() => deleteTask(task)}><Trash2 size={15} aria-hidden="true" />Delete</button>
        </div>
      </td>
    </tr>
  );
}

function Settings({ data, userId, supabase, refresh, showToast }: CrudProps) {
  async function createItem(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    if (!name) return showToast("Item name is required.");
    const { error } = await supabase.from("items").insert({
      user_id: userId,
      name,
      category_id: String(formData.get("category_id") || "") || null,
      tracking_type: String(formData.get("tracking_type")) as TrackingType,
      default_target: Number(formData.get("default_target") || 1),
      unit: String(formData.get("unit") || "unit"),
      priority: String(formData.get("priority")) as Priority,
      active: true,
    });
    if (error) return showToast(`Item create failed: ${error.message}`);
    showToast("Item created. Schedule it in Planner to affect scoring.");
    await refresh();
  }

  async function deleteItem(item: Item) {
    if (!window.confirm(`Delete "${item.name}"? This also removes related plans and logs.`)) return;
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) return showToast(`Item delete failed: ${error.message}`);
    showToast("Item deleted.");
    await refresh();
  }

  async function updateItem(item: Item, patch: Partial<Item>) {
    const next = { ...item, ...patch };
    if (!next.name.trim()) return showToast("Item name is required.");
    if (Number(next.default_target) < 0) return showToast("Target cannot be negative.");
    const { error } = await supabase
      .from("items")
      .update({
        name: next.name,
        category_id: next.category_id || null,
        tracking_type: next.tracking_type,
        default_target: Number(next.default_target || 0),
        unit: next.unit || targetUnitFallback(next.tracking_type),
        priority: next.priority,
        active: next.active,
      })
      .eq("id", item.id);
    if (error) return showToast(`Item update failed: ${error.message}`);
    showToast("Item saved.");
    await refresh();
  }

  function exportJson() {
    download("habit-command-center-export.json", JSON.stringify(data, null, 2), "application/json");
  }

  return (
    <div className="grid">
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h3>Add Trackable Item</h3><span>Set target and unit once, adjust anytime</span></div>
          <form action={createItem} className="task-form">
            <input name="name" placeholder="Item name" required />
            <select name="category_id"><CategoryOptions categories={data.categories} /></select>
            <select name="tracking_type"><option value="done">Done</option><option value="count">Count</option><option value="hours">Hours</option></select>
            <input name="default_target" type="number" min="0" step="0.25" defaultValue="1" aria-label="Default target" />
            <input name="unit" defaultValue="hr" aria-label="Unit" />
            <select name="priority"><PriorityOptions /></select>
            <button className="primary"><Plus size={17} aria-hidden="true" />Create item</button>
          </form>
        </section>
        <section className="panel">
          <div className="section-title"><h3>Backup</h3><span>Private data export</span></div>
          <button type="button" className="secondary" onClick={exportJson}><Download size={17} aria-hidden="true" />Export JSON</button>
        </section>
      </div>
      <section className="panel">
        <div className="section-title"><h3>Trackable Items</h3><span>{data.items.length} total</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Category</th><th>Type</th><th>Target</th><th>Unit</th><th>Priority</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{data.items.map((item) => <ItemEditRow key={item.id} item={item} categories={data.categories} updateItem={updateItem} deleteItem={deleteItem} />)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ItemEditRow({
  item,
  categories,
  updateItem,
  deleteItem,
}: {
  item: Item;
  categories: Category[];
  updateItem: (item: Item, patch: Partial<Item>) => Promise<void>;
  deleteItem: (item: Item) => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(item.category_id || "");
  const [trackingType, setTrackingType] = useState<TrackingType>(item.tracking_type);
  const [target, setTarget] = useState(item.default_target);
  const [unit, setUnit] = useState(item.unit);
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [active, setActive] = useState(item.active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(item.name);
    setCategoryId(item.category_id || "");
    setTrackingType(item.tracking_type);
    setTarget(item.default_target);
    setUnit(item.unit);
    setPriority(item.priority);
    setActive(item.active);
  }, [item]);

  async function handleSave() {
    setSaving(true);
    await updateItem(item, { name, category_id: categoryId || null, tracking_type: trackingType, default_target: target, unit, priority, active });
    setSaving(false);
  }

  return (
    <tr>
      <td><input value={name} onChange={(event) => setName(event.target.value)} /></td>
      <td><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><CategoryOptions categories={categories} /></select></td>
      <td><select value={trackingType} onChange={(event) => setTrackingType(event.target.value as TrackingType)}><option value="done">Done</option><option value="count">Count</option><option value="hours">Hours</option></select></td>
      <td><input type="number" min="0" step="0.25" value={target} onChange={(event) => setTarget(Number(event.target.value))} /></td>
      <td><input value={unit} onChange={(event) => setUnit(event.target.value)} /></td>
      <td><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><PriorityOptions /></select></td>
      <td><select value={active ? "true" : "false"} onChange={(event) => setActive(event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></td>
      <td>
        <div className="row-actions">
          <button type="button" className="small-button" disabled={saving} onClick={handleSave}><Save size={15} aria-hidden="true" />{saving ? "Saving" : "Save"}</button>
          <button type="button" className="small-button danger-button" onClick={() => deleteItem(item)}><Trash2 size={15} aria-hidden="true" />Delete</button>
        </div>
      </td>
    </tr>
  );
}

type CrudProps = {
  data: AppData;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  refresh: () => Promise<void>;
  showToast: (message: string) => void;
};

function Metric({ label, value, detail, pct }: { label: string; value: string; detail: string; pct: number }) {
  return <section className="panel metric"><span>{label}</span><strong>{value}</strong><div className="score-line"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div><small>{detail}</small></section>;
}

function TaskCard({ task }: { task: Task }) {
  return <div className="card"><strong>{task.title}</strong><br /><span className="muted">{formatDate(task.start_date)} - {formatDate(task.deadline_date)}</span></div>;
}

function CategoryOptions({ categories }: { categories: Category[] }) {
  return <><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</>;
}

function PriorityOptions() {
  return <>{(Object.keys(priorityWeights) as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</>;
}

function ChartPie({ rows }: { rows: Array<{ name: string; value: number }> }) {
  if (!rows.length) return <p className="muted">No logged hours in this range yet.</p>;
  return <div className="chart-box"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={rows} dataKey="value" nameKey="name" outerRadius={100} label>{rows.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>;
}

function ChartBars({ rows }: { rows: Array<{ name: string; value: number }> }) {
  if (!rows.length) return <p className="muted">No logged hours in this range yet.</p>;
  return <div className="chart-box"><ResponsiveContainer width="100%" height={260}><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#315f9a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}

function hoursByCategory(data: AppData, dates: string[]) {
  const totals = new Map<string, number>();
  data.logs.filter((log) => dates.includes(log.date)).forEach((log) => {
    const item = data.items.find((candidate) => candidate.id === log.item_id);
    if (!item || item.tracking_type !== "hours") return;
    const category = data.categories.find((candidate) => candidate.id === item.category_id);
    const name = category?.name || "Uncategorized";
    totals.set(name, (totals.get(name) || 0) + Number(log.actual_value || 0));
  });
  return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
}

function dayProgress(score: ReturnType<typeof scoreForDate>) {
  const complete = score.rows.filter((row) => row.status === "complete").length;
  const missed = score.rows.filter((row) => row.status === "missed").length;
  return { complete, missed, pending: score.pending, total: score.rows.length };
}

function isItem(entity: Item | Task): entity is Item {
  return "tracking_type" in entity;
}

function formatPlanTarget(plan: Plan, entity: Item | Task) {
  if (!isItem(entity)) return "Done";
  return formatTarget(Number(plan.target ?? entity.default_target), entity.unit, entity.tracking_type);
}

function formatItemTarget(item: Item) {
  return formatTarget(item.default_target, item.unit, item.tracking_type);
}

function formatTarget(target: number, unit: string, trackingType: TrackingType) {
  if (trackingType === "done") return "Done";
  const cleanTarget = Number.isInteger(target) ? String(target) : String(target);
  const cleanUnit = displayUnit(unit, target);
  return `${cleanTarget} ${cleanUnit}`.trim();
}

function displayUnit(unit: string, target: number) {
  const normalized = unit.trim().toLowerCase();
  if (["h", "hr", "hour", "hours"].includes(normalized)) return target === 1 ? "hr" : "hrs";
  return unit || "units";
}

function targetUnitFallback(trackingType: TrackingType) {
  if (trackingType === "hours") return "hr";
  if (trackingType === "count") return "units";
  return "done";
}

function heatColor(percent: number, possible: number) {
  if (!possible) return "var(--surface-3)";
  if (percent >= 90) return "#15803d";
  if (percent >= 75) return "#2f8f67";
  if (percent >= 50) return "#b7791f";
  if (percent > 0) return "#b45309";
  return "#334155";
}

function removeFromSet<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function optimisticPlans(
  plans: Plan[],
  input: { userId: string; date: string; itemId: string | null; taskId: string | null; scheduled: boolean; target: number },
) {
  const existing = plans.find((plan) => plan.date === input.date && plan.item_id === input.itemId && plan.task_id === input.taskId);
  if (existing) {
    return plans.map((plan) => plan.id === existing.id ? { ...plan, scheduled: input.scheduled, target: input.target } : plan);
  }
  const optimistic: Plan = {
    id: `optimistic-${input.date}-${input.itemId || input.taskId}`,
    user_id: input.userId,
    date: input.date,
    item_id: input.itemId,
    task_id: input.taskId,
    scheduled: input.scheduled,
    target: input.target,
    source: "weekly_plan",
  };
  return [...plans, optimistic];
}

function upsertPlan(plans: Plan[], savedPlan: Plan) {
  const sameSubject = (plan: Plan) =>
    plan.date === savedPlan.date &&
    (plan.item_id || null) === (savedPlan.item_id || null) &&
    (plan.task_id || null) === (savedPlan.task_id || null);
  return [...plans.filter((plan) => plan.id !== savedPlan.id && !sameSubject(plan)), savedPlan];
}

function upsertLog(logs: Log[], savedLog: Log) {
  const sameSubject = (log: Log) =>
    log.date === savedLog.date &&
    (log.item_id || null) === (savedLog.item_id || null) &&
    (log.task_id || null) === (savedLog.task_id || null) &&
    log.is_extra === savedLog.is_extra;
  return [...logs.filter((log) => log.id !== savedLog.id && !sameSubject(log)), savedLog];
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
