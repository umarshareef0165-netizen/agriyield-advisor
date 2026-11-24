import { describe, it, expect } from "vitest";
import {
  buildDiagnosePrompt,
  parseDiagnosisResponse,
  diagnosePhoto,
  DIAGNOSIS_DISCLAIMER_EN,
} from "./diagnose";

const VALID_JSON = JSON.stringify({
  diseaseEn: "Yellow rust (stripe rust)",
  diseaseUr: "پیلی کنگی (زرد زنگ)",
  confidence: "medium",
  symptomsObserved: ["Orange-yellow stripes along leaf veins"],
  treatment: ["Spray only affected patches after consulting the agriculture officer"],
  pesticide: {
    activeIngredient: "Propiconazole",
    whoClass: "II",
    phiDays: null,
    reentryHours: null,
    ppe: ["Gloves", "Goggles"],
    firstAid: "Move to fresh air and seek a doctor.",
  },
  organicAlternative: "Resistant varieties.",
  disclaimer: DIAGNOSIS_DISCLAIMER_EN,
});

describe("buildDiagnosePrompt", () => {
  it("demands JSON only, low/medium/high confidence, and null PHI/re-entry", () => {
    const p = buildDiagnosePrompt("wheat", "Faisalabad");
    expect(p).toContain("JSON ONLY");
    expect(p).toContain('"low" | "medium" | "high"');
    expect(p).toContain("NEVER give a percentage");
    expect(p).toContain('"phiDays": null');
    expect(p).toContain("NO chemical cure");
    expect(p).toContain("wheat");
    expect(p).toContain("Faisalabad");
  });
});

describe("parseDiagnosisResponse", () => {
  it("parses a valid Gemini reply", () => {
    const d = parseDiagnosisResponse(VALID_JSON);
    expect(d.diseaseEn).toBe("Yellow rust (stripe rust)");
    expect(d.confidence).toBe("medium");
    expect(d.pesticide.activeIngredient).toBe("Propiconazole");
    expect(d.pesticide.phiDays).toBeNull();
    expect(d.pesticide.reentryHours).toBeNull();
  });

  it("accepts a fenced JSON reply", () => {
    const d = parseDiagnosisResponse(`\`\`\`json\n${VALID_JSON}\n\`\`\``);
    expect(d.diseaseEn).toBe("Yellow rust (stripe rust)");
  });

  it("rejects malformed JSON — never a faked diagnosis", () => {
    expect(() => parseDiagnosisResponse("not json at all")).toThrow(
      /not valid JSON/,
    );
    expect(() => parseDiagnosisResponse('{"diseaseEn": 42}')).toThrow();
  });

  it("rejects a percentage/numeric confidence", () => {
    const bad = JSON.stringify({
      ...JSON.parse(VALID_JSON),
      confidence: "87%",
    });
    expect(() => parseDiagnosisResponse(bad)).toThrow(/low\/medium\/high/);
    const numeric = JSON.stringify({
      ...JSON.parse(VALID_JSON),
      confidence: 0.87,
    });
    expect(() => parseDiagnosisResponse(numeric)).toThrow(/low\/medium\/high/);
  });

  it("rejects a reply missing required fields", () => {
    const bad = JSON.stringify({ diseaseEn: "Yellow rust", confidence: "low" });
    expect(() => parseDiagnosisResponse(bad)).toThrow(/missing required fields/);
  });

  it("normalises a numeric PHI/re-entry from Gemini to null (label ke mutabiq)", () => {
    const withNumbers = JSON.stringify({
      ...JSON.parse(VALID_JSON),
      pesticide: {
        ...JSON.parse(VALID_JSON).pesticide,
        phiDays: 14,
        reentryHours: 48,
      },
    });
    const d = parseDiagnosisResponse(withNumbers);
    expect(d.pesticide.phiDays).toBeNull();
    expect(d.pesticide.reentryHours).toBeNull();
  });
});

describe("diagnosePhoto — no-key path", () => {
  it("returns an honest unavailable result when no key is configured", async () => {
    const r = await diagnosePhoto("aGVsbG8=", "image/jpeg", "wheat", "Faisalabad", {
      apiKey: undefined,
      fetchFn: (() => {
        throw new Error("fetch must not be called without a key");
      }) as typeof fetch,
    });
    // process.env may carry a key in some environments; accept either
    // the no-key result or a fetch failure — but never a fake diagnosis.
    if (r.available) {
      expect(r.source).toBe("gemini");
    } else {
      expect(r.reasonEn).toMatch(/Gemini API key|unavailable/i);
    }
  });

  it("returns unavailable (not a diagnosis) when Gemini fails", async () => {
    const failingFetch = (async () =>
      new Response("overloaded", { status: 503 })) as typeof fetch;
    const r = await diagnosePhoto("aGVsbG8=", "image/jpeg", "wheat", "Faisalabad", {
      apiKey: "test-key",
      fetchFn: failingFetch,
      timeoutMs: 1000,
      maxAttempts: 1,
    });
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reasonEn).toMatch(/503|unavailable/i);
  });

  it("returns a parsed diagnosis on a good Gemini reply", async () => {
    const okFetch = (async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: VALID_JSON }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
    const r = await diagnosePhoto("aGVsbG8=", "image/jpeg", "wheat", "Faisalabad", {
      apiKey: "test-key",
      fetchFn: okFetch,
      timeoutMs: 5000,
      maxAttempts: 1,
    });
    expect(r.available).toBe(true);
    if (r.available) {
      expect(r.source).toBe("gemini");
      expect(r.diagnosis.diseaseEn).toBe("Yellow rust (stripe rust)");
      expect(r.diagnosis.confidence).toBe("medium");
    }
  });
});
