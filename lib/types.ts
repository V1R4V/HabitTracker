export type Priority = "low" | "normal" | "high" | "critical";
export type TrackingType = "done" | "count" | "hours";
export type TaskStatus = "not_started" | "in_progress" | "done" | "paused";
export type LogStatus = "pending" | "complete" | "missed";
export type PlanSource = "weekly_plan" | "one_off" | "imported";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type Item = {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  tracking_type: TrackingType;
  default_target: number;
  unit: string;
  priority: Priority;
  active: boolean;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  linked_item_id: string | null;
  priority: Priority;
  status: TaskStatus;
  start_date: string;
  deadline_date: string;
  notes: string;
};

export type Plan = {
  id: string;
  user_id: string;
  date: string;
  item_id: string | null;
  task_id: string | null;
  scheduled: boolean;
  target: number | null;
  source: PlanSource;
};

export type Log = {
  id: string;
  user_id: string;
  date: string;
  item_id: string | null;
  task_id: string | null;
  actual_value: number;
  status: LogStatus;
  is_extra: boolean;
  notes: string;
};

export type WeeklyNote = {
  id: string;
  user_id: string;
  week_start_date: string;
  body: string;
};

export type Note = {
  id: string;
  user_id: string;
  body: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AppData = {
  categories: Category[];
  items: Item[];
  tasks: Task[];
  plans: Plan[];
  logs: Log[];
  weeklyNotes: WeeklyNote[];
  notes: Note[];
};
