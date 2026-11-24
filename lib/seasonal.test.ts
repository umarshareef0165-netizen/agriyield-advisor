import { describe, it, expect } from "vitest";
import { seasonalWatch, currentMonthPk } from "./seasonal";

describe("seasonalWatch", () => {
  it("returns November's wheat sowing watch", () => {
    const entries = seasonalWatch(11);
    expect(entries).toHaveLength(1);
    expect(entries[0].crop).toBe("wheat");
    expect(entries[0].watchEn).toMatch(/1-20 November/);
    expect(entries[0].generalGuidance).toBe(false);
  });

  it("filters by crop within a month", () => {
    expect(seasonalWatch(7, "rice")).toHaveLength(1);
    expect(seasonalWatch(7, "wheat")).toHaveLength(0);
  });

  it("flags general-guidance entries (reminder to scout, not a forecast)", () => {
    const jan = seasonalWatch(1);
    expect(jan).toHaveLength(1);
    expect(jan[0].generalGuidance).toBe(true);
    expect(jan[0].pestOrDisease).toMatch(/rust/i);
  });

  it("returns an empty list for an out-of-range month — never a guess", () => {
    expect(seasonalWatch(0)).toHaveLength(0);
    expect(seasonalWatch(13)).toHaveLength(0);
  });

  it("covers all 12 months", () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonalWatch(m).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("currentMonthPk is a valid month", () => {
    const m = currentMonthPk();
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(12);
  });
});
