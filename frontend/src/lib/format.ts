// Locale-pinned formatters. Exam schedules are read by staff on shared
// machines with mixed OS locales, so dates always render in Canadian English.
const LOCALE = "en-CA";

const dateFmt = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", year: "numeric" });
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const dateShortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", month: "short", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const monthDayFmt = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const monthNameFmt = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "2-digit" });
const relFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const numFmt = new Intl.NumberFormat(LOCALE);

type DateInput = string | number | Date | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === "") return null;
  // Bare YYYY-MM-DD strings are calendar dates, not UTC instants.
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Dec 9, 2026" */
export function formatDate(v: DateInput, fallback = "—"): string {
  const d = toDate(v);
  return d ? dateFmt.format(d) : fallback;
}

/** "Wed, Dec 9, 2026" */
export function formatDateLong(v: DateInput, fallback = "—"): string {
  const d = toDate(v);
  return d ? dateLongFmt.format(d) : fallback;
}

/** "Wed, Dec 9" */
export function formatDateShort(v: DateInput, fallback = "—"): string {
  const d = toDate(v);
  return d ? dateShortFmt.format(d) : fallback;
}

/** "Dec 9, 2026, 9:00 a.m." */
export function formatDateTime(v: DateInput, fallback = "—"): string {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d) : fallback;
}

/** "9:00 a.m." from "09:00" or "09:00:00" */
export function formatTime(t: string | null | undefined, fallback = ""): string {
  if (!t) return fallback;
  const d = new Date(`1970-01-01T${t.length === 5 ? `${t}:00` : t}`);
  return Number.isNaN(d.getTime()) ? fallback : timeFmt.format(d);
}

/** "11:00" from a start like "09:00" and a length in minutes; empty until both are given. */
export function endTime(start: string, minutes: number): string {
  if (!start || !minutes) return "";
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "Dec 26" for chart axes */
export function formatMonth(v: DateInput): string {
  const d = toDate(v);
  return d ? monthFmt.format(d) : "";
}

/** "Dec 9" */
export function formatMonthDay(v: DateInput): string {
  const d = toDate(v);
  return d ? monthDayFmt.format(d) : "";
}

/** "Dec" */
export function formatMonthName(v: DateInput): string {
  const d = toDate(v);
  return d ? monthNameFmt.format(d) : "";
}

/** "in 3 days", "tomorrow", "2 hours ago" */
export function formatRelative(v: DateInput, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return "";
  const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  // A bare date has no time of day, so count calendar days: "today", "tomorrow", not "in 3 hours".
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((d.getTime() - today.getTime()) / DAY);
    if (Math.abs(days) < 60) return relFmt.format(days, "day");
  }
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < HOUR) return relFmt.format(Math.round(diff / MIN), "minute");
  if (abs < DAY) return relFmt.format(Math.round(diff / HOUR), "hour");
  // Days up to two months, so nearby dates read alike ("in 44 days", "in 48 days", not "in 2 months").
  if (abs < 60 * DAY) return relFmt.format(Math.round(diff / DAY), "day");
  if (abs < 365 * DAY) return relFmt.format(Math.round(diff / (30 * DAY)), "month");
  return relFmt.format(Math.round(diff / (365 * DAY)), "year");
}

export function formatNumber(n: number): string {
  return numFmt.format(n);
}

/** plural(1, "student") → "1 student"; plural(3, "student") → "3 students" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
