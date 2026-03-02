import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// ISO Week helpers
// ============================================================

/** Return the ISO week number for a Date (week starts Monday, ISO 8601). */
export function dateToISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1..Sun=7)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Parse "YYYY-MM-DD" and return ISO week number, or null if invalid. */
export function getISOWeek(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const d = new Date(dateString + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return dateToISOWeek(d);
}

/** Return current ISO week number. */
export function currentISOWeek(): number {
  return dateToISOWeek(new Date());
}

const WEEK_FILTER_KEY = 'vsro_week_filter';

export function loadWeekFilter(): string {
  try {
    return localStorage.getItem(WEEK_FILTER_KEY) ?? 'all';
  } catch {
    return 'all';
  }
}

export function saveWeekFilter(value: string): void {
  try {
    localStorage.setItem(WEEK_FILTER_KEY, value);
  } catch { /* ignore */ }
}
