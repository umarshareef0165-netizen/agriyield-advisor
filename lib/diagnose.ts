/**
 * Photo diagnosis — Gemini vision (gemini-3.8-flash) over a farmer's crop
 * photo, with a strict JSON-only contract.
 *
 * Budget (same as lib/agent.ts / lib/timeout.ts): each generate is capped
 * at 8s, at most 2 attempts, 0.5s backoff. Worst case 16.5s.
 *
 * Honesty rules (non-negotiable):
 * - Confidence is low/medium/high ONLY — never a percentage.
 * - PHI and re-entry are null in the verified dataset; the prompt demands
 *   null, and any number Gemini returns anyway is discarded to null —
 *   the UI shows "label ke mutabiq", never a number.
 * - No accuracy/efficacy percentage anywhere.
 * - The result is AI-assisted, NOT a lab test — stated in the prompt,
 *   the response and the UI.
 * - If the key is missing or Gemini fails, the result is a typed
 *   honest-unavailable answer — never a faked diagnosis.
 */
import {
  UPSTREAM_TIMEOUT_MS,
  GEMINI_MAX_ATTEMPTS,
  GEMINI_RETRY_DELAY_MS,
} from "./timeout";

export const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const DIAGNOSIS_DISCLAIMER_EN =
  "AI-assisted identification from a photo only — NOT a lab test. Confirm with your district agriculture office or a plant clinic before spraying.";
export const DIAGNOSIS_DISCLAIMER_UR =
  "صرف تصویر سے AI کی مدد سے شناخت — یہ لیب ٹیسٹ نہیں ہے۔ اسپرے سے پہلے اپنے ضلعی زرعی دفتر یا پلانٹ کلینک سے تصدیق کریں۔";

export interface DiagnosisPesticide {
  activeIngredient: string;
  whoClass: string;
  phiDays: null;
  reentryHours: null;
  ppe: string[];
  firstAid: string;
}

export interface Diagnosis {
  diseaseEn: string;
  diseaseUr: string;
  confidence: "low" | "medium" | "high";
  symptomsObserved: string[];
  treatment: string[];
  pesticide: DiagnosisPesticide;
  organicAlternative: string;
  disclaimer: string;
}

export type DiagnoseResult =
  | {
      available: true;
      source: "gemini";
      model: string;
      diagnosis: Diagnosis;
    }
  | {
      available: false;
      reasonEn: string;
      reasonUr: string;
    };

/** Strict prompt: JSON ONLY, with the honesty rules baked in. */
export function buildDiagnosePrompt(crop: string, district: string): string {
  return [
    "You are AgriYield Advisor, a plant-disease assistant for smallholder farmers in Punjab, Pakistan.",
    `Look at the attached photo of a ${crop} crop from district ${district} and identify the disease or pest problem.`,
    "Reply with JSON ONLY — no markdown fences, no extra text — in exactly this shape:",
    '{ "diseaseEn": "...", "diseaseUr": "... (Urdu script)", "confidence": "low" | "medium" | "high", "symptomsObserved": ["..."], "treatment": ["..."], "pesticide": { "activeIngredient": "...", "whoClass": "Ia" | "Ib" | "II" | "III" | "U", "phiDays": null, "reentryHours": null, "ppe": ["..."], "firstAid": "..." }, "organicAlternative": "...", "disclaimer": "..." }',
    "STRICT RULES:",
    "1. confidence must be exactly one of low, medium or high. NEVER give a percentage or a number for confidence or accuracy.",
    "2. phiDays and reentryHours must be null — no product-specific pre-harvest or re-entry interval is verified. NEVER invent a number of days or hours; the farmer must follow the product label.",
    "3. If the photo is unclear, the crop is not identifiable, or no disease is visible, set diseaseEn to 'Not identifiable from this photo', diseaseUr to 'اس تصویر سے شناخت ممکن نہیں', confidence to 'low', and explain in treatment that a clearer photo or a plant clinic visit is needed.",
    "4. If it is a virus (for example cotton leaf curl or tomato leaf curl), state clearly that there is NO chemical cure — the pesticide controls only the insect vector.",
    "5. Never invent a dose, a PHI, an accuracy figure, or a product brand. Give the active ingredient only, per the product label.",
    `6. disclaimer must be exactly: "${DIAGNOSIS_DISCLAIMER_EN}"`,
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * Parse + strictly validate Gemini's JSON reply. Unknown or malformed
 * JSON is an honest error — never a faked diagnosis. A numeric
 * confidence, a percentage anywhere in the confidence field, or a
 * numeric phiDays/reentryHours is rejected or normalised to null per the
 * honesty rules (see below).
 */
export function parseDiagnosisResponse(text: string): Diagnosis {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Gemini returned a reply that is not valid JSON — no diagnosis can be shown.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Gemini returned JSON that is not a diagnosis object.");
  }
  const o = parsed as Record<string, unknown>;
  const confidence = o.confidence;
  if (
    confidence !== "low" &&
    confidence !== "medium" &&
    confidence !== "high"
  ) {
    throw new Error(
      "Gemini returned a confidence that is not low/medium/high — no diagnosis can be shown.",
    );
  }
  const p = o.pesticide as Record<string, unknown> | undefined;
  if (
    !isNonEmptyString(o.diseaseEn) ||
    !isNonEmptyString(o.diseaseUr) ||
    !isStringArray(o.symptomsObserved) ||
    !isStringArray(o.treatment) ||
    !p ||
    !isNonEmptyString(p.activeIngredient) ||
    !isNonEmptyString(p.whoClass) ||
    !isStringArray(p.ppe) ||
    !isNonEmptyString(p.firstAid) ||
    !isNonEmptyString(o.organicAlternative)
  ) {
    throw new Error(
      "Gemini returned a diagnosis missing required fields — no diagnosis can be shown.",
    );
  }
  // PHI / re-entry: no product-specific value is verified anywhere in
  // this app. Whatever Gemini put there, the stored value is null and
  // the UI shows "label ke mutabiq".
  return {
    diseaseEn: o.diseaseEn as string,
    diseaseUr: o.diseaseUr as string,
    confidence,
    symptomsObserved: o.symptomsObserved as string[],
    treatment: o.treatment as string[],
    pesticide: {
      activeIngredient: p.activeIngredient as string,
      whoClass: p.whoClass as string,
      phiDays: null,
      reentryHours: null,
      ppe: p.ppe as string[],
      firstAid: p.firstAid as string,
    },
    organicAlternative: o.organicAlternative as string,
    disclaimer: isNonEmptyString(o.disclaimer)
      ? (o.disclaimer as string)
      : DIAGNOSIS_DISCLAIMER_EN,
  };
}

interface GeminiVisionResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function callGeminiVisionOnce(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<string> {
  const res = await fetchFn(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new Error(
      `Gemini ${GEMINI_MODEL} returned HTTP ${res.status}: ${body.slice(0, 200)}`,
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  const data = (await res.json()) as GeminiVisionResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty answer.");
  return text;
}

/**
 * Diagnose a crop photo. Returns a typed honest-unavailable result when
 * the key is missing or Gemini fails — never a diagnosis.
 */
export async function diagnosePhoto(
  imageBase64: string,
  mimeType: string,
  crop: string,
  district: string,
  opts?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
    timeoutMs?: number;
    maxAttempts?: number;
  },
): Promise<DiagnoseResult> {
  const apiKey = opts?.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      available: false,
      reasonEn:
        "Photo diagnosis needs a Gemini API key, which is not set on this server. The symptom checker below still works without it.",
      reasonUr:
        "تصویر کی تشخیص کے لیے Gemini API کی ضرورت ہے، جو اس سرور پر سیٹ نہیں ہے۔ نیچے دیا گیا علامات چیکر اس کے بغیر بھی کام کرتا ہے۔",
    };
  }
  const fetchFn = opts?.fetchFn ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const maxAttempts = opts?.maxAttempts ?? GEMINI_MAX_ATTEMPTS;
  const prompt = buildDiagnosePrompt(crop, district);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const text = await callGeminiVisionOnce(
        imageBase64,
        mimeType,
        prompt,
        apiKey,
        fetchFn,
        timeoutMs,
      );
      return {
        available: true,
        source: "gemini",
        model: GEMINI_MODEL,
        diagnosis: parseDiagnosisResponse(text),
      };
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const timedOut = (error as Error).name === "TimeoutError";
      const retryable = status === 503 || status === 429 || timedOut;
      if (!retryable || attempt === maxAttempts) break;
      await sleep(GEMINI_RETRY_DELAY_MS);
    }
  }
  const status = (lastError as { status?: number } | null)?.status;
  const reasonEn =
    status === 503
      ? "Gemini is overloaded right now (HTTP 503) — photo diagnosis is unavailable. Try again later, or use the symptom checker below."
      : status === 429
        ? "Gemini is rate-limited right now (HTTP 429) — photo diagnosis is unavailable. Try again later, or use the symptom checker below."
        : `Photo diagnosis is unavailable (${(lastError as Error)?.message?.slice(0, 120) ?? "Gemini error"}) — no diagnosis is shown. Try again later, or use the symptom checker below.`;
  return {
    available: false,
    reasonEn,
    reasonUr:
      "تصویر کی تشخیص ابھی دستیاب نہیں ہے — بعد میں دوبارہ کوشش کریں، یا نیچے دیا گیا علامات چیکر استعمال کریں۔",
  };
}
