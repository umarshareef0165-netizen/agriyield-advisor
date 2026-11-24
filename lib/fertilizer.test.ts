import { describe, it, expect } from "vitest";
import { recommendFertilizer, BAG_WEIGHT_KG } from "./fertilizer";

describe("recommendFertilizer", () => {
  it("uses 50 kg bags", () => {
    expect(BAG_WEIGHT_KG).toBe(50);
  });

  it("wheat: standard dose, whole bags, labelled standard-dose", () => {
    const r = recommendFertilizer("wheat", 10);
    expect(r.available).toBe(true);
    if (!r.available) return;
    // 1.75 urea, 1.5 DAP, 1 SOP/MOP bags per acre × 10 acres, rounded up.
    expect(r.ureaBags).toBe(18);
    expect(r.dapBags).toBe(15);
    expect(r.mopBags).toBe(10);
    expect(r.basis).toBe("standard-dose");
    expect(r.soilUsed).toBe(false);
    expect(r.ureaKgPerAcre).toBe(87.5);
    expect(r.source).toMatch(/Punjab Agriculture Department/);
    expect(r.bagsCalculated).toBe(false); // wheat bags are quoted, not calculated
  });

  it("rounds fractional bag totals up (a farmer buys whole bags)", () => {
    const r = recommendFertilizer("wheat", 1);
    expect(r.available).toBe(true);
    if (!r.available) return;
    expect(r.ureaBags).toBe(2); // ceil(1.75)
    expect(r.dapBags).toBe(2); // ceil(1.5)
    expect(r.mopBags).toBe(1);
  });

  it("rice and maize use the calculated Punjab range doses", () => {
    const rice = recommendFertilizer("rice", 2);
    expect(rice.available).toBe(true);
    if (!rice.available) return;
    expect(rice.ureaBags).toBe(4); // 2.0 × 2
    expect(rice.dapBags).toBe(3); // 1.5 × 2
    expect(rice.bagsCalculated).toBe(true);
    const maize = recommendFertilizer("maize", 1);
    expect(maize.available).toBe(true);
    if (!maize.available) return;
    expect(maize.ureaBags).toBe(4); // ceil(3.5)
    expect(maize.dapBags).toBe(3); // ceil(2.5)
  });

  it("soil readings do not change the dose — no verified adjustment rule", () => {
    const withSoil = recommendFertilizer("wheat", 5, 120, 7.5);
    const without = recommendFertilizer("wheat", 5);
    expect(withSoil.available).toBe(true);
    if (!withSoil.available || !without.available) return;
    expect(withSoil.ureaBags).toBe(without.ureaBags);
    expect(withSoil.soilUsed).toBe(false);
    expect(withSoil.soilNoteEn).toMatch(/no verified rule/i);
  });

  it("tomato is unavailable — no verified dose, never a guess", () => {
    const r = recommendFertilizer("tomato", 5);
    expect(r.available).toBe(false);
    if (r.available) return;
    expect(r.reasonEn).toMatch(/No verified.*dose/i);
    expect(r.reasonUr).toBeTruthy();
  });

  it("unknown crop is unavailable", () => {
    const r = recommendFertilizer("potato", 5);
    expect(r.available).toBe(false);
  });
});
