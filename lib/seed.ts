import { addDays } from "./date";
import type { Category, Item, Plan, Task } from "./types";

export function buildSeed(userId: string) {
  const categories: Omit<Category, "id">[] = [
    { user_id: userId, name: "Career", color: "#21715d", sort_order: 1 },
    { user_id: userId, name: "Study", color: "#315f9a", sort_order: 2 },
    { user_id: userId, name: "Health", color: "#b94f2d", sort_order: 3 },
    { user_id: userId, name: "Projects", color: "#8a6b18", sort_order: 4 },
    { user_id: userId, name: "Reading", color: "#6f4aa3", sort_order: 5 },
    { user_id: userId, name: "Network", color: "#417b72", sort_order: 6 },
    { user_id: userId, name: "Finance", color: "#9b3d55", sort_order: 7 },
  ];

  return { categories };
}

export function itemSeeds(userId: string, categoryIds: Record<string, string>) {
  const rows: Array<Omit<Item, "id">> = [
    item(userId, "Wake 6 AM", categoryIds.Health, "done", 1, "done", "normal"),
    item(userId, "Meditation", categoryIds.Health, "done", 1, "done", "normal"),
    item(userId, "Gym", categoryIds.Health, "hours", 2, "h", "high"),
    item(userId, "Wind down + sleep <=11", categoryIds.Health, "done", 1, "done", "normal"),
    item(userId, "DSA", categoryIds.Study, "hours", 3, "h", "critical"),
    item(userId, "NeetCode", categoryIds.Study, "count", 2, "q", "high"),
    item(userId, "Frontend Questions", categoryIds.Study, "count", 1, "q", "normal"),
    item(userId, "Lab/Startup", categoryIds.Career, "hours", 2, "h", "high"),
    item(userId, "Job Applications", categoryIds.Career, "count", 4, "apps", "critical"),
    item(userId, "LinkedIn DMs", categoryIds.Network, "count", 2, "msgs", "high"),
    item(userId, "System Design", categoryIds.Study, "hours", 1.5, "h", "high"),
    item(userId, "Project #5", categoryIds.Projects, "hours", 2, "h", "high"),
    item(userId, "Build From Empty", categoryIds.Projects, "done", 1, "done", "normal"),
    item(userId, "DDIA Pages", categoryIds.Reading, "count", 5, "pages", "normal"),
    item(userId, "Investing", categoryIds.Finance, "hours", 1, "h", "low"),
    item(userId, "Coffee Chat", categoryIds.Network, "done", 1, "done", "normal"),
  ];
  return rows;
}

function item(
  user_id: string,
  name: string,
  category_id: string,
  tracking_type: Item["tracking_type"],
  default_target: number,
  unit: string,
  priority: Item["priority"],
): Omit<Item, "id"> {
  return { user_id, name, category_id, tracking_type, default_target, unit, priority, active: true };
}

export function taskSeeds(userId: string, categoryId: string): Array<Omit<Task, "id">> {
  return [
    task(userId, "APPLY TO COMPOSIO", "high", "2026-05-11", "2026-05-13", "", categoryId),
    task(userId, "REQUEST FOR REFERALL COMPOSIO", "high", "2026-05-11", "2026-05-17", "", categoryId),
    task(userId, "FINISH DUE DILLEGENCE", "normal", "2026-05-11", "2026-05-17", "", categoryId),
    task(userId, "New Portfolio website", "normal", "2026-05-11", "2026-05-24", "Add 639 projects, IDD app images, and related assets.", categoryId),
  ];
}

function task(
  user_id: string,
  title: string,
  priority: Task["priority"],
  start_date: string,
  deadline_date: string,
  notes: string,
  category_id: string,
): Omit<Task, "id"> {
  return { user_id, title, category_id, linked_item_id: null, priority, status: "not_started", start_date, deadline_date, notes };
}

export function planSeeds(userId: string, items: Item[]): Array<Omit<Plan, "id">> {
  const rows: Array<Omit<Plan, "id">> = [];
  const start = "2026-05-04";
  for (let index = 0; index < 98; index += 1) {
    const date = addDays(start, index);
    items.forEach((itemRow) => {
      rows.push({
        user_id: userId,
        date,
        item_id: itemRow.id,
        task_id: null,
        scheduled: isDefaultScheduled(itemRow.name, date),
        target: itemRow.default_target,
        source: "imported",
      });
    });
  }
  return rows;
}

function isDefaultScheduled(name: string, date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  if (["Investing", "Coffee Chat", "DDIA Pages", "Build From Empty"].includes(name)) return day === 1 || day === 3 || day === 5;
  if (name === "Gym") return day !== 0;
  return true;
}
