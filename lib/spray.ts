/**
 * Spray window — the best hours to spray in the next 48 hours, from the
 * live Open-Meteo hourly forecast.
 *
 * Thresholds (stated in code, in the API response and in the UI — the same
 * values everywhere):
 * - precipitation probability < 20%
 * - wind speed < 15 km/h
 * - precipitation < 0.1 mm in the hour
 *
 * An hour is suitable only if all three hold. Consecutive suitable hours
 * are grouped into windows. This module adds its own hourly Open-Meteo
 * call — lib/weather.ts (daily forecast) is untouched.
 */
import { UPSTREAM_TIMEOUT_MS } from "./timeout";
import type { DayForecast } from "./weather";

export type { DayForecast } from "./weather";

export const SPRAY_PRECIP_PROB_MAX_PCT = 20;
export const SPRAY_WIND_MAX_KMH = 15;
export const SPRAY_PRECIP_MAX_MM = 0.1;

export const SPRAY_METHOD =
  "Suitable hour: rain chance < 20%, wind < 15 km/h, rain < 0.1 mm. Source: Open-Meteo hourly forecast (Asia/Karachi).";

export interface HourlyPoint {
  /** Local time, e.g. "2026-11-24T06:00". */
  time: string;
  precipProbPct: number | null;
  windKmh: number | null;
  precipMm: number | null;
}

export interface SprayWindow {
  start: string;
  end: string;
  hours: number;
}

export interface SprayResult {
  source: "Open-Meteo";
  sourceUrl: string;
  timezone: "Asia/Karachi";
  method: string;
  thresholds: {
    precipProbMaxPct: number;
    windMaxKmh: number;
    precipMaxMm: number;
  };
  windows: SprayWindow[];
  best: SprayWindow | null;
  hoursChecked: number;
  suitableHours: number;
}

export function isSuitableSprayHour(h: HourlyPoint): boolean {
  return (
    h.precipProbPct !== null &&
    h.windKmh !== null &&
    h.precipMm !== null &&
    h.precipProbPct < SPRAY_PRECIP_PROB_MAX_PCT &&
    h.windKmh < SPRAY_WIND_MAX_KMH &&
    h.precipMm < SPRAY_PRECIP_MAX_MM
  );
}

function addHour(isoLocal: string, n: number): string {
  // Clock arithmetic on the Asia/Karachi wall time, done in UTC so the
  // VM's own timezone can never shift the result (a +05:00 offset parsed
  // with local getters was the bug here).
  const [datePart, timePart] = isoLocal.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h + n, mi));
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** Group suitable hours (within the next 48h) into consecutive windows. */
export function sprayWindowsFromHourly(hours: HourlyPoint[]): SprayResult {
  const window48 = hours.slice(0, 48);
  const suitable = window48.filter(isSuitableSprayHour);
  const windows: SprayWindow[] = [];
  for (const h of suitable) {
    const last = windows[windows.length - 1];
    if (last && addHour(last.end, 0) === h.time) {
      // Consecutive hour — extend the window (end is exclusive).
      last.end = addHour(h.time, 1);
      last.hours += 1;
    } else {
      windows.push({ start: h.time, end: addHour(h.time, 1), hours: 1 });
    }
  }
  return {
    source: "Open-Meteo",
    sourceUrl: "",
    timezone: "Asia/Karachi",
    method: SPRAY_METHOD,
    thresholds: {
      precipProbMaxPct: SPRAY_PRECIP_PROB_MAX_PCT,
      windMaxKmh: SPRAY_WIND_MAX_KMH,
      precipMaxMm: SPRAY_PRECIP_MAX_MM,
    },
    windows,
    best: windows[0] ?? null,
    hoursChecked: window48.length,
    suitableHours: suitable.length,
  };
}

export function buildHourlyUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: [
      "precipitation_probability",
      "wind_speed_10m",
      "precipitation",
    ].join(","),
    timezone: "Asia/Karachi",
    forecast_days: "3",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Parse an Open-Meteo hourly-forecast JSON body. Pure. */
export function parseHourly(json: unknown): HourlyPoint[] {
  const body = json as {
    hourly?: Record<string, Array<number | null | string>>;
    error?: boolean;
    reason?: string;
  };
  if (body?.error) {
    throw new Error(`Open-Meteo error: ${body.reason ?? "unknown"}`);
  }
  const hourly = body?.hourly;
  const times = hourly?.time as unknown as string[] | undefined;
  if (!hourly || !Array.isArray(times) || times.length === 0) {
    throw new Error("Open-Meteo returned no hourly forecast.");
  }
  const pick = (key: string, i: number): number | null => {
    const arr = hourly[key];
    if (!Array.isArray(arr)) return null;
    const v = arr[i];
    return typeof v === "number" ? v : null;
  };
  return times.map((time, i) => ({
    time,
    precipProbPct: pick("precipitation_probability", i),
    windKmh: pick("wind_speed_10m", i),
    precipMm: pick("precipitation", i),
  }));
}

/**
 * Fetch the hourly forecast and return the next-48h spray windows.
 * Capped at 8s (UPSTREAM_TIMEOUT_MS) like every other upstream call.
 */
export async function fetchSprayWindow(
  lat: number,
  lon: number,
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS,
): Promise<SprayResult> {
  const url = buildHourlyUrl(lat, lon);
  let res: Response;
  try {
    res = await fetchFn(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    throw new Error(`Could not reach Open-Meteo: ${(error as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new Error(
        "Open-Meteo daily request limit reached for this server — spray window is unavailable right now, try again later.",
      );
    }
    throw new Error(`Open-Meteo returned HTTP ${res.status}: ${text.slice(0, 160)}`);
  }
  const result = sprayWindowsFromHourly(parseHourly(await res.json()));
  result.sourceUrl = url;
  return result;
}

/**
 * Day-level fallback from the existing daily forecast (no hourly data):
 * ranks the next 48h days by rain chance and wind, and recommends the
 * early-morning hours (06:00–09:00, when wind is usually lowest) on the
 * best day. Clearly labelled as a day-level guide, not an hourly window.
 */
export function sprayWindow(days: DayForecast[]): {
  bestDay: string | null;
  bestDaySuitable: boolean;
  recommendedHours: string;
  reasonEn: string;
  reasonUr: string;
  method: string;
} {
  const next2 = days.slice(0, 2);
  const scored = next2
    .map((d) => ({
      date: d.date,
      suitable:
        d.precipProbPct !== null &&
        d.windKmh !== null &&
        d.precipProbPct < SPRAY_PRECIP_PROB_MAX_PCT &&
        d.windKmh < SPRAY_WIND_MAX_KMH,
      prob: d.precipProbPct ?? 999,
      wind: d.windKmh ?? 999,
    }))
    .sort((a, b) => a.prob - b.prob || a.wind - b.wind);
  const best = scored[0] ?? null;
  return {
    bestDay: best?.date ?? null,
    bestDaySuitable: best?.suitable ?? false,
    recommendedHours: "06:00–09:00",
    reasonEn: best
      ? best.suitable
        ? `${best.date} looks best in the next 48 hours (rain chance ${best.prob}%, wind ${best.wind} km/h) — spray in the early morning, 06:00–09:00. This is a day-level guide; the hourly spray window above is more precise.`
        : `No day in the next 48 hours is clearly suitable (best is ${best.date}: rain chance ${best.prob}%, wind ${best.wind} km/h) — wait for a calmer, drier slot.`
      : "No forecast days available — spray window cannot be judged.",
    reasonUr: best
      ? best.suitable
        ? `${best.date} اگلے 48 گھنٹوں میں بہترین لگتا ہے (بارش کا امکان ${best.prob}٪، ہوا ${best.wind} کلومیٹر/گھنٹہ) — صبح سویرے 06:00–09:00 اسپرے کریں۔ یہ دن کی سطح کی رہنمائی ہے؛ اوپر دیا گیا گھنٹہ وار وقت زیادہ درست ہے۔`
        : `اگلے 48 گھنٹوں میں کوئی دن واضح طور پر موزوں نہیں ہے (بہترین ${best.date}: بارش کا امکان ${best.prob}٪، ہوا ${best.wind} کلومیٹر/گھنٹہ) — پرسکون، خشک وقت کا انتظار کریں۔`
      : "پیش گوئی کے دن دستیاب نہیں — اسپرے کا وقت نہیں بتایا جا سکتا۔",
    method: `Day-level guide from the daily forecast. Hourly rule: rain chance < ${SPRAY_PRECIP_PROB_MAX_PCT}%, wind < ${SPRAY_WIND_MAX_KMH} km/h, rain < ${SPRAY_PRECIP_MAX_MM} mm.`,
  };
}
