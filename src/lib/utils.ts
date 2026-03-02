import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Factory Week helpers (week runs Friday 00:00 → Thursday 23:59)
// ============================================================

/** Return the first Friday on or after Jan 1 of the given year. */
function firstFridayOfYear(year: number): Date {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const day = jan1.getUTCDay(); // 0=Sun … 5=Fri 6=Sat
  const daysUntilFri = (5 - day + 7) % 7; // 0 if already Friday
  return new Date(Date.UTC(year, 0, 1 + daysUntilFri));
}

/** Return the most recent Friday (start of factory week) for a given UTC date. */
function weekStartFriday(d: Date): Date {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay(); // 0=Sun…6=Sat
  const diff = (day - 5 + 7) % 7; // days since last Friday (0 if Friday)
  return new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate() - diff));
}

/** Compute Factory Week number for a Date. */
export function dateToFactoryWeek(d: Date): number {
  const ws = weekStartFriday(d);
  let year = ws.getUTCFullYear();
  let ff = firstFridayOfYear(year);

  // If ws is before first Friday of its year → last FW of previous year
  if (ws.getTime() < ff.getTime()) {
    year -= 1;
    ff = firstFridayOfYear(year);
  }

  return Math.floor((ws.getTime() - ff.getTime()) / (7 * 86400000)) + 1;
}

/** Parse "YYYY-MM-DD" and return Factory Week number, or null if invalid. */
export function getFactoryWeek(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const d = new Date(dateString + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return dateToFactoryWeek(d);
}

/** Return current Factory Week number. */
export function currentFactoryWeek(): number {
  return dateToFactoryWeek(new Date());
}

const KW_FILTER_KEY = 'vsro_kw_filter';

/** KW filter value: 'all' | 'this' | comma-separated numbers like '10,11' */
export type KwFilterValue = string;

export function loadKwFilter(): KwFilterValue {
  try {
    return localStorage.getItem(KW_FILTER_KEY) ?? 'this';
  } catch {
    return 'this';
  }
}

export function saveKwFilter(value: KwFilterValue): void {
  try {
    localStorage.setItem(KW_FILTER_KEY, value);
  } catch { /* ignore */ }
}

/** Parse KW filter value into a set of week numbers, or null for 'all'. */
export function parseKwFilter(value: KwFilterValue): number[] | null {
  if (value === 'all') return null;
  if (value === 'this') return [currentFactoryWeek()];
  const nums = value.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
  return nums.length > 0 ? nums : null;
}
