import { describe, it, expect } from "vitest";
import {
  isSuitableSprayHour,
  sprayWindowsFromHourly,
  sprayWindow,
  parseHourly,
  SPRAY_PRECIP_PROB_MAX_PCT,
  SPRAY_WIND_MAX_KMH,
  SPRAY_PRECIP_MAX_MM,
  type HourlyPoint,
  type DayForecast,
} from "./spray";

describe("spray thresholds", () => {
  it("are rain chance < 20%, wind < 15 km/h, rain < 0.1 mm", () => {
    expect(SPRAY_PRECIP_PROB_MAX_PCT).toBe(20);
    expect(SPRAY_WIND_MAX_KMH).toBe(15);
    expect(SPRAY_PRECIP_MAX_MM).toBe(0.1);
  });

  it("accepts a calm dry hour and rejects each failing condition", () => {
    const good: HourlyPoint = {
      time: "2026-11-24T06:00",
      precipProbPct: 5,
      windKmh: 8,
      precipMm: 0,
    };
    expect(isSuitableSprayHour(good)).toBe(true);
    expect(isSuitableSprayHour({ ...good, precipProbPct: 20 })).toBe(false);
    expect(isSuitableSprayHour({ ...good, precipProbPct: 19 })).toBe(true);
    expect(isSuitableSprayHour({ ...good, windKmh: 15 })).toBe(false);
    expect(isSuitableSprayHour({ ...good, windKmh: 14.9 })).toBe(true);
    expect(isSuitableSprayHour({ ...good, precipMm: 0.1 })).toBe(false);
    expect(isSuitableSprayHour({ ...good, precipProbPct: null })).toBe(false);
    expect(isSuitableSprayHour({ ...good, windKmh: null })).toBe(false);
  });
});

function hour(time: string, prob: number, wind: number, mm = 0): HourlyPoint {
  return { time, precipProbPct: prob, windKmh: wind, precipMm: mm };
}

describe("sprayWindowsFromHourly", () => {
  it("groups consecutive suitable hours into windows and picks the first as best", () => {
    const hours = [
      hour("2026-11-24T06:00", 5, 8),
      hour("2026-11-24T07:00", 10, 9),
      hour("2026-11-24T08:00", 50, 9), // rain — breaks the window
      hour("2026-11-24T09:00", 5, 20), // wind — not suitable
      hour("2026-11-24T10:00", 0, 7),
    ];
    const r = sprayWindowsFromHourly(hours);
    expect(r.windows).toHaveLength(2);
    expect(r.windows[0]).toEqual({
      start: "2026-11-24T06:00",
      end: "2026-11-24T08:00",
      hours: 2,
    });
    expect(r.windows[1].start).toBe("2026-11-24T10:00");
    expect(r.best).toEqual(r.windows[0]);
    expect(r.hoursChecked).toBe(5);
    expect(r.suitableHours).toBe(3);
    expect(r.method).toMatch(/< 20%/);
  });

  it("returns no windows when nothing is suitable", () => {
    const hours = [hour("2026-11-24T06:00", 80, 30, 2)];
    const r = sprayWindowsFromHourly(hours);
    expect(r.windows).toHaveLength(0);
    expect(r.best).toBeNull();
  });

  it("only looks at the next 48 hours", () => {
    const hours = Array.from({ length: 50 }, (_, i) => {
      const day = i < 24 ? "2026-11-24" : i < 48 ? "2026-11-25" : "2026-11-26";
      const h = String(i % 24).padStart(2, "0");
      return hour(`${day}T${h}:00`, 0, 5);
    });
    const r = sprayWindowsFromHourly(hours);
    expect(r.hoursChecked).toBe(48);
    expect(r.suitableHours).toBe(48);
  });
});

describe("parseHourly", () => {
  it("parses an Open-Meteo hourly body", () => {
    const hours = parseHourly({
      hourly: {
        time: ["2026-11-24T06:00", "2026-11-24T07:00"],
        precipitation_probability: [5, 10],
        wind_speed_10m: [8, 9],
        precipitation: [0, 0],
      },
    });
    expect(hours).toHaveLength(2);
    expect(hours[0]).toEqual({
      time: "2026-11-24T06:00",
      precipProbPct: 5,
      windKmh: 8,
      precipMm: 0,
    });
  });

  it("throws on an error body or missing hours", () => {
    expect(() => parseHourly({ error: true, reason: "bad" })).toThrow();
    expect(() => parseHourly({})).toThrow(/no hourly forecast/);
  });
});

describe("sprayWindow (day-level guide from the daily forecast)", () => {
  const days: DayForecast[] = [
    {
      date: "2026-11-24",
      tMaxC: 28,
      tMinC: 14,
      precipMm: 0,
      precipProbPct: 5,
      humidityPct: 55,
      windKmh: 10,
      et0Mm: 3.1,
    },
    {
      date: "2026-11-25",
      tMaxC: 29,
      tMinC: 13,
      precipMm: 4,
      precipProbPct: 80,
      humidityPct: 70,
      windKmh: 18,
      et0Mm: 2.4,
    },
  ];

  it("picks the drier, calmer day and recommends early morning", () => {
    const r = sprayWindow(days);
    expect(r.bestDay).toBe("2026-11-24");
    expect(r.bestDaySuitable).toBe(true);
    expect(r.recommendedHours).toBe("06:00–09:00");
  });

  it("reports no suitable day when both days fail the thresholds", () => {
    const wet = days.map((d) => ({ ...d, precipProbPct: 90, windKmh: 25 }));
    const r = sprayWindow(wet);
    expect(r.bestDaySuitable).toBe(false);
    expect(r.reasonEn).toMatch(/No day.*suitable/i);
  });

  it("handles an empty forecast honestly", () => {
    expect(sprayWindow([]).bestDay).toBeNull();
  });
});
