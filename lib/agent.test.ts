import { describe, it, expect, vi, afterEach } from "vitest";
import {
  deterministicAnswer,
  buildPrompt,
  answerWithGemini,
  type AnswerContext,
} from "./agent";

const CTX: AnswerContext = {
  question: "Is haftay gandum ko pani kab dun?",
  language: "roman",
  districtNameEn: "Faisalabad",
  districtNameUr: "فیصل آباد",
  crop: "wheat",
  cropNameEn: "Wheat",
  cropNameUr: "گندم",
  weather: {
    ok: true,
    days: [
      {
        date: "2026-11-07",
        tMaxC: 28.5,
        tMinC: 14,
        precipMm: 0,
        precipProbPct: 5,
        humidityPct: 55,
        windKmh: 12,
        et0Mm: 3.1,
      },
    ],
    advice: {
      action: "irrigate",
      bestDay: "2026-11-07",
      rainNext48hMm: 0,
      rainDaysNext3: [],
      hottestDay: { date: "2026-11-07", tMaxC: 28.5 },
      reasonEn: "No rain expected — irrigate on 2026-11-07 in the early morning.",
      reasonUr: "بارش متوقع نہیں — 2026-11-07 کو صبح سویرے پانی دیں۔",
    },
  },
  soil: { ok: true, summary: "pH 7.8 (Alkaline); texture Loam." },
  market: null,
  yieldForecast: {
    crop: "wheat",
    nameEn: "Wheat",
    nameUr: "گندم",
    method: "Linear trend on FAO/OWID Pakistan series.",
    targetYear: 2025,
    forecast: 3.3,
    bandLow: 3.1,
    bandHigh: 3.5,
    rmse: 0.12,
    mae: 0.09,
    lastValue: 3.2683,
    lastYear: 2024,
    avg5: 3.03,
    avg10: 2.93,
    trendPerYear: 0.037,
    seriesLast10: [],
    source: "Our World in Data (FAO)",
  },
  planSteps: [
    {
      date: "2026-11-07",
      titleEn: "Irrigate — early morning",
      titleUr: "پانی دیں — صبح سویرے",
      detailEn: "No rain expected.",
      detailUr: "بارش متوقع نہیں۔",
    },
  ],
};

describe("deterministicAnswer", () => {
  it("composes a Roman Urdu answer containing the cited numbers", () => {
    const text = deterministicAnswer(CTX);
    expect(text).toContain("2026-11-07");
    expect(text).toContain("28.5");
    expect(text).toContain("3.3");
    expect(text).toContain("3.1");
    expect(text).toContain("3.5");
  });

  it("says plainly when weather is unavailable instead of inventing it", () => {
    const noWeather: AnswerContext = {
      ...CTX,
      weather: { ok: false, error: "Open-Meteo daily request limit reached." },
    };
    const text = deterministicAnswer(noWeather);
    expect(text).toContain("dastiyab nahi");
    expect(text).not.toContain("28.5");
  });

  it("renders an English answer when the language is English", () => {
    const text = deterministicAnswer({ ...CTX, language: "en" });
    expect(text).toContain("District: Faisalabad");
    expect(text).toContain("3.3 t/ha");
  });
});

describe("buildPrompt", () => {
  it("grounds the prompt in tool data and forbids invention", () => {
    const prompt = buildPrompt(CTX);
    expect(prompt).toContain("Use ONLY the numbers in the TOOL DATA");
    expect(prompt).toContain("3.3");
    expect(prompt).toContain("Is haftay gandum ko pani kab dun?");
    expect(prompt).toContain("Roman Urdu");
  });
});

describe("answerWithGemini retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries on 503 then succeeds", async () => {
    const ok = new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Test answer." }] } }],
      }),
      { status: 200 },
    );
    const fail = new Response("high demand", { status: 503 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);
    const out = await answerWithGemini("prompt", "fake-key");
    expect(out).toBe("Test answer.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after 3 failed attempts", async () => {
    const fail = new Response("high demand", { status: 503 });
    const fetchMock = vi.fn().mockResolvedValue(fail);
    vi.stubGlobal("fetch", fetchMock);
    await expect(answerWithGemini("prompt", "fake-key")).rejects.toThrow("503");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
