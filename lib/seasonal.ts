/**
 * Seasonal watch — month-by-month pest/disease reminders from the Punjab
 * cropping calendar (data/seasonal-watch.json, generated 2026-11-24).
 *
 * Entries flagged generalGuidance are general extension timing, not a
 * dated Punjab advisory — the UI presents them as a reminder to scout,
 * never as a forecast.
 */
import watchData from "../data/seasonal-watch.json";

export interface WatchEntry {
  month: number;
  crop: string;
  pestOrDisease: string;
  watchEn: string;
  watchUr: string;
  generalGuidance: boolean;
}

const WATCH: WatchEntry[] = (watchData as { watch: WatchEntry[] }).watch;

export const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_NAMES_UR = [
  "جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون",
  "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر",
];

/**
 * Watch entries for a month (1–12), optionally filtered to one crop.
 * Returns an empty list for an out-of-range month — never a guess.
 */
export function seasonalWatch(month: number, crop?: string): WatchEntry[] {
  if (!Number.isInteger(month) || month < 1 || month > 12) return [];
  return WATCH.filter(
    (w) => w.month === month && (!crop || w.crop === crop),
  );
}

/** Current month in Asia/Karachi (1–12). */
export function currentMonthPk(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      month: "numeric",
    }).format(new Date()),
  );
}
