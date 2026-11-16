import { describe, it, expect } from "vitest";
import {
  isFirebaseConfigured,
  initDeviceModel,
  synthesizeAnswer,
  speakUrdu,
  generatePlanImage,
  buildHybridPrompt,
  buildPlanImagePrompt,
} from "./firebase-ai";
import type { AskResult } from "./orchestrate";

/** Minimal valid AskResult — every number in it is deliberate and dated. */
const RESULT: AskResult = {
  question: "Is haftay gandum ko pani kab dun?",
  language: "roman",
  district: {
    slug: "faisalabad",
    nameEn: "Faisalabad",
    nameUr: "فیصل آباد",
    lat: 31.42,
    lon: 73.08,
  },
  crop: "wheat",
  cropNameEn: "Wheat",
  cropNameUr: "گندم",
  intents: ["irrigation"],
  answer: {
    text: "Server answer (fixture).",
    source: "fallback",
    fallbackReason: "Fixture — no key.",
  },
  citations: [
    {
      label: "Weather today",
      detail: "Max 28.5°C, min 14°C, rain 0 mm (5% chance)",
      source: "Open-Meteo (live)",
    },
    {
      label: "Irrigation water need (next 7 days)",
      detail:
        "Net 3.1 mm after rain (ET0 3.1 mm, rain 0 mm) — about 12,545 litres per acre",
      source: "Open-Meteo ET0 + rain (computed)",
    },
    {
      label: "Market price — Wheat (REFERENCE)",
      detail: "Rs. 5,500 per 40 kg, published 2 Nov 2026",
      source: "AMIS Punjab",
    },
    {
      label: "Yield forecast 2027",
      detail:
        "3.2 t/ha (range 2.9–3.5), in-sample RMSE 0.24 t/ha",
      source: "FAO/OWID Pakistan series",
    },
  ],
  plan: [
    {
      date: "2026-11-20",
      titleEn: "Irrigate",
      titleUr: "پانی دیں",
      detailEn: "Irrigate in the early morning.",
      detailUr: "صبح سویرے پانی دیں۔",
      basis: "No rain expected in the next 48 hours.",
    },
  ],
  revenue: null,
  tools: {
    weather: { status: "ok" },
    soil: { status: "unavailable", error: "SoilGrids 500." },
    market: { status: "ok" },
    yield: { status: "ok" },
  },
};

describe("firebase-ai — placeholder config fails closed", () => {
  it("isFirebaseConfigured() is false while the config is a placeholder", () => {
    expect(isFirebaseConfigured()).toBe(false);
  });

  it("initDeviceModel() is a safe no-op when not configured", async () => {
    await expect(initDeviceModel()).resolves.toBeUndefined();
  });

  it("synthesizeAnswer() rejects with a not-configured error", async () => {
    await expect(synthesizeAnswer("hello")).rejects.toThrow(
      /not configured/i,
    );
  });

  it("speakUrdu() rejects with a not-configured error", async () => {
    await expect(speakUrdu("hello")).rejects.toThrow(/not configured/i);
  });

  it("generatePlanImage() rejects with a not-configured error", async () => {
    await expect(generatePlanImage("a plan card")).rejects.toThrow(
      /not configured/i,
    );
  });
});

describe("buildHybridPrompt — grounded in the AskResult only", () => {
  const prompt = buildHybridPrompt(RESULT);

  it("carries the question, district and crop", () => {
    expect(prompt).toContain(RESULT.question);
    expect(prompt).toContain("Faisalabad");
    expect(prompt).toContain("Wheat");
  });

  it("carries every cited number and its source", () => {
    expect(prompt).toContain("28.5");
    expect(prompt).toContain("3.1 mm");
    expect(prompt).toContain("5,500");
    expect(prompt).toContain("3.2 t/ha");
    expect(prompt).toContain("Open-Meteo");
    expect(prompt).toContain("AMIS Punjab");
  });

  it("labels market prices as REFERENCE and states the strict rules", () => {
    expect(prompt).toContain("REFERENCE");
    expect(prompt).toContain("Use ONLY the numbers in the CITED FACTS");
    expect(prompt).toContain("GROSS revenue BEFORE costs");
  });

  it("contains no number that is not in the result", () => {
    // Sentinel: a figure nowhere in the fixture must not appear.
    expect(prompt).not.toContain("999.9");
    expect(prompt).not.toContain("Rs. 99,999");
  });

  it("includes the dated plan steps", () => {
    expect(prompt).toContain("2026-11-20");
    expect(prompt).toContain("Irrigate in the early morning.");
  });
});

describe("buildPlanImagePrompt — facts only, nothing invented", () => {
  const prompt = buildPlanImagePrompt(RESULT);

  it("names the crop, district and plan steps", () => {
    expect(prompt).toContain("Wheat");
    expect(prompt).toContain("Faisalabad");
    expect(prompt).toContain("2026-11-20");
    expect(prompt).toContain("Irrigate");
  });

  it("carries the computed water need and no invented figure", () => {
    expect(prompt).toContain("Net 3.1 mm");
    expect(prompt).not.toContain("999.9");
  });
});
