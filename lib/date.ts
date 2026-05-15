export const msDay = 24 * 60 * 60 * 1000;

export function toIsoDate(date: Date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export function todayIso() {
  return toIsoDate(new Date());
}

export function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function startOfWeek(iso: string) {
  const date = parseIso(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
}

export function dateRange(start: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(start, index));
}

export function monthDates(selectedIso: string) {
  const first = `${selectedIso.slice(0, 7)}-01`;
  const date = parseIso(first);
  const dates: string[] = [];
  while (toIsoDate(date).slice(0, 7) === selectedIso.slice(0, 7)) {
    dates.push(toIsoDate(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export function formatDate(iso: string) {
  return parseIso(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dayName(iso: string) {
  return parseIso(iso).toLocaleDateString("en-US", { weekday: "short" });
}
