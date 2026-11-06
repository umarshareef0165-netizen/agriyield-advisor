/**
 * The AgriYield agent: Gemini-primary with an honest deterministic fallback.
 * Pattern taken from the PayPerPrompt app (lib/agent.ts): Gemini
 * (gemini-3.8-flash) via the `x-goog-api-key` header, retried with backoff
 * on 503/429. The key is set at deploy time only (GEMINI_API_KEY) — the app
 * works end-to-end without it.
 *
 * The agent NEVER invents numbers: the prompt hands Gemini only the tool
 * results gathered for this question, and instructs it to cite every figure
 * and to say "I don't know" when data is missing. The deterministic fallback
 * composes the same answer from the same tool results with templates, and is
 * always labelled as a fallback in the UI and the API response.
 */
import type { DayForecast, IrrigationAdvice } from "./weather";
import type { MarketResult } from "./market";
import type { YieldForecast } from "./yield";

export const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AnswerContext {
  question: string;
  language: "ur" | "roman" | "en";
  districtNameEn: string;
  districtNameUr: string;
  crop: string;
  cropNameEn: string;
  cropNameUr: string;
  weather: {
    ok: boolean;
    error?: string;
    days?: DayForecast[];
    advice?: IrrigationAdvice;
  };
  soil: { ok: boolean; error?: string; summary?: string };
  market: MarketResult | null;
  yieldForecast: YieldForecast | null;
  yieldUnavailableReason?: string;
  planSteps: Array<{
    date: string;
    titleEn: string;
    titleUr: string;
    detailEn: string;
    detailUr: string;
  }>;
}

export interface AgentAnswer {
  text: string;
  /** "gemini" = real LLM answer; "fallback" = deterministic template. */
  source: "gemini" | "fallback";
  model?: string;
  fallbackReason?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function callGeminiOnce(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 700, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new Error(
      `Gemini ${GEMINI_MODEL} returned HTTP ${res.status}: ${body.slice(0, 200)}`,
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty answer.");
  return text;
}

export async function answerWithGemini(
  prompt: string,
  apiKey: string,
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGeminiOnce(prompt, apiKey);
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const retryable = status === 503 || status === 429;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 2000);
    }
  }
  throw lastError;
}

/** Build the grounded prompt: only tool results, nothing else. */
export function buildPrompt(ctx: AnswerContext): string {
  const lang =
    ctx.language === "ur"
      ? "Urdu script (اردو)"
      : ctx.language === "roman"
        ? "Roman Urdu (Latin script)"
        : "English";
  const weatherBlock = ctx.weather.ok
    ? JSON.stringify(ctx.weather.days ?? [], null, 1) +
      `\nIrrigation advice (computed from the forecast): ${ctx.weather.advice?.action} — ${ctx.weather.advice?.reasonEn}`
    : `UNAVAILABLE: ${ctx.weather.error ?? "weather data could not be fetched"}`;
  const soilBlock = ctx.soil.ok
    ? (ctx.soil.summary ?? "Soil data fetched.")
    : `UNAVAILABLE: ${ctx.soil.error ?? "soil data could not be fetched"}`;
  const marketBlock = ctx.market
    ? JSON.stringify(
        {
          kind: "REFERENCE (not live)",
          published: ctx.market.published,
          source: ctx.market.source,
          unit: ctx.market.unit,
          punjabAverage: ctx.market.punjabAverage,
          rangeLow: ctx.market.rangeLow,
          rangeHigh: ctx.market.rangeHigh,
          districtPrice: ctx.market.districtPrice,
          comparison: ctx.market.comparisonEn,
        },
        null,
        1,
      )
    : "No market data for this crop.";
  const yieldBlock = ctx.yieldForecast
    ? JSON.stringify(
        {
          crop: ctx.yieldForecast.nameEn,
          targetYear: ctx.yieldForecast.targetYear,
          forecast_t_per_ha: ctx.yieldForecast.forecast,
          band_low: ctx.yieldForecast.bandLow,
          band_high: ctx.yieldForecast.bandHigh,
          in_sample_rmse: ctx.yieldForecast.rmse,
          last_observed: `${ctx.yieldForecast.lastValue} t/ha (${ctx.yieldForecast.lastYear})`,
          avg_5y: ctx.yieldForecast.avg5,
          method: ctx.yieldForecast.method,
        },
        null,
        1,
      )
    : `NO YIELD FORECAST: ${ctx.yieldUnavailableReason ?? "not available for this crop"}`;
  const planBlock = ctx.planSteps
    .map((s) => `${s.date}: ${s.titleEn} — ${s.detailEn}`)
    .join("\n");

  return [
    "You are AgriYield Advisor, an AI data agent for smallholder farmers in Punjab, Pakistan.",
    `Answer the farmer's question in ${lang}. Keep it short, plain, and actionable — what to do, when, and why.`,
    "STRICT RULES:",
    "1. Use ONLY the numbers in the TOOL DATA below. Never invent a number, price, date, or yield.",
    "2. Cite the source of every figure you use (Open-Meteo, SoilGrids, AMIS Punjab reference prices, FAO/OWID yield series).",
    "3. If a tool's data is UNAVAILABLE, say so plainly and give only what is known — never fill the gap with a guess.",
    "4. Market prices are REFERENCE prices from the published date, not live — say so if you mention them.",
    "5. The yield forecast is a statistical trend baseline with an uncertainty band — always give the band, never a single magic number.",
    "",
    `Farmer's question: ${ctx.question}`,
    `District: ${ctx.districtNameEn} (${ctx.districtNameUr}). Crop: ${ctx.cropNameEn} (${ctx.cropNameUr}).`,
    "",
    "TOOL DATA — WEATHER (Open-Meteo, live):",
    weatherBlock,
    "",
    "TOOL DATA — SOIL (ISRIC SoilGrids, live):",
    soilBlock,
    "",
    "TOOL DATA — MARKET (reference):",
    marketBlock,
    "",
    "TOOL DATA — YIELD FORECAST (trend baseline):",
    yieldBlock,
    "",
    "PLAN (dated steps):",
    planBlock,
    "",
    "Answer now, in the farmer's language, with citations after each figure.",
  ].join("\n");
}

/** Strip trailing periods so templates don't produce ".." after an error sentence. */
function sent(s: string): string {
  return s.replace(/\.+$/, "");
}

/**
 * Deterministic fallback answer: the same tool results, composed with
 * templates in the farmer's language. Always labelled as a fallback.
 */
export function deterministicAnswer(ctx: AnswerContext): string {
  const L = ctx.language;
  const lines: string[] = [];
  /** If a tool was skipped because the question did not need it, say only that. */
  const weatherUnavailable = (fallbackEn: string): string => {
    const err = ctx.weather.error ?? fallbackEn;
    if (err.toLowerCase().includes("not needed")) return err;
    return L === "en"
      ? `${sent(err)}. I will not guess the weather — check again shortly.`
      : L === "roman"
        ? `${sent(err)}. Main mausam ka andaza nahi lagaunga — thodi dair baad dobara dekhein.`
        : `${sent(err)}۔ میں موسم کا اندازہ نہیں لگاؤں گا — تھوڑی دیر بعد دوبارہ دیکھیں۔`;
  };
  const planLines = ctx.planSteps.map((s) => {
    if (L === "en") return `- ${s.date}: ${s.titleEn} — ${s.detailEn}`;
    if (L === "roman") return `- ${s.date}: ${s.titleEn} — ${s.detailEn}`;
    return `- ${s.date}: ${s.titleUr} — ${s.detailUr}`;
  });

  if (L === "en") {
    lines.push(
      `District: ${ctx.districtNameEn}. Crop: ${ctx.cropNameEn}.`,
    );
    if (ctx.weather.ok && ctx.weather.advice) {
      lines.push(`Weather (Open-Meteo, live): ${ctx.weather.advice.reasonEn}`);
      const d0 = ctx.weather.days?.[0];
      if (d0) {
        lines.push(
          `Today (${d0.date}): max ${d0.tMaxC ?? "?"}°C, min ${d0.tMinC ?? "?"}°C, rain ${d0.precipMm ?? "?"} mm (chance ${d0.precipProbPct ?? "?"}%).`,
        );
      }
    } else {
      lines.push(
        `Weather is unavailable right now: ${weatherUnavailable("the forecast could not be fetched")}`,
      );
    }
    if (ctx.soil.ok) lines.push(`Soil (ISRIC SoilGrids): ${ctx.soil.summary ?? ""}`);
    else lines.push(`Soil data is unavailable right now: ${sent(ctx.soil.error ?? "could not be fetched")}.`);
    if (ctx.market) {
      const price = ctx.market.districtPrice ?? ctx.market.punjabAverage;
      if (price !== null) {
        lines.push(
          `Market (REFERENCE, published ${ctx.market.published}, ${ctx.market.source}): ${ctx.market.nameEn} Rs. ${price.toLocaleString()} ${ctx.market.unit}. This is not a live rate — confirm at your local mandi before selling.`,
        );
      }
      if (ctx.market.comparisonEn) lines.push(ctx.market.comparisonEn);
    }
    if (ctx.yieldForecast) {
      const y = ctx.yieldForecast;
      lines.push(
        `Yield forecast for ${y.targetYear} (trend baseline on the FAO/OWID Pakistan series, in-sample RMSE ${y.rmse} t/ha): ${y.forecast} t/ha, range ${y.bandLow}–${y.bandHigh} t/ha. Last observed ${y.lastValue} t/ha (${y.lastYear}); 5-year average ${y.avg5} t/ha. National average — your district will differ.`,
      );
    } else if (ctx.yieldUnavailableReason) {
      lines.push(`Yield forecast: ${ctx.yieldUnavailableReason}`);
    }
    if (ctx.planSteps.length > 0) {
      lines.push("Your plan:");
      lines.push(...planLines);
    }
    return lines.join("\n");
  }

  if (L === "roman") {
    lines.push(`Zila: ${ctx.districtNameEn}. Fasal: ${ctx.cropNameEn}.`);
    if (ctx.weather.ok && ctx.weather.advice) {
      lines.push(`Mausam (Open-Meteo, live): ${ctx.weather.advice.reasonUr}`);
      const d0 = ctx.weather.days?.[0];
      if (d0) {
        lines.push(
          `Aaj (${d0.date}): zyada se zyada ${d0.tMaxC ?? "?"}°C, kam se kam ${d0.tMinC ?? "?"}°C, barish ${d0.precipMm ?? "?"} mm (imkan ${d0.precipProbPct ?? "?"}%).`,
        );
      }
    } else {
      lines.push(
        `Mausam ki maloomat abhi dastiyab nahi: ${weatherUnavailable("pesh goi nahi mil saki")}`,
      );
    }
    if (ctx.soil.ok) lines.push(`Mitti (ISRIC SoilGrids): ${ctx.soil.summary ?? ""}`);
    else lines.push(`Mitti ki maloomat abhi dastiyab nahi: ${sent(ctx.soil.error ?? "nahi mil saki")}.`);
    if (ctx.market) {
      const price = ctx.market.districtPrice ?? ctx.market.punjabAverage;
      if (price !== null) {
        lines.push(
          `Mandi (REFERENCE, ${ctx.market.published} ko shaya, ${ctx.market.source}): ${ctx.market.nameEn} Rs. ${price.toLocaleString()} ${ctx.market.unit}. Yeh live rate nahi hai — bechnay se pehle apni mandi se tasdeeq karein.`,
        );
      }
      if (ctx.market.comparisonEn) lines.push(ctx.market.comparisonEn);
    }
    if (ctx.yieldForecast) {
      const y = ctx.yieldForecast;
      lines.push(
        `${y.targetYear} ki paidawar ka andaza (FAO/OWID Pakistan series par trend baseline, RMSE ${y.rmse} t/ha): ${y.forecast} t/ha, had ${y.bandLow}–${y.bandHigh} t/ha. Akhri darj ${y.lastValue} t/ha (${y.lastYear}); 5 saal ki ausat ${y.avg5} t/ha. Yeh qomi ausat hai — aap ke zila mein farq ho sakta hai.`,
      );
    } else if (ctx.yieldUnavailableReason) {
      lines.push(`Paidawar ka andaza: ${ctx.yieldUnavailableReason}`);
    }
    if (ctx.planSteps.length > 0) {
      lines.push("Aap ka plan:");
      lines.push(...planLines);
    }
    return lines.join("\n");
  }

  // Urdu script (default)
  lines.push(`ضلع: ${ctx.districtNameUr}۔ فصل: ${ctx.cropNameUr}۔`);
  if (ctx.weather.ok && ctx.weather.advice) {
    lines.push(`موسم (Open-Meteo، براہ راست): ${ctx.weather.advice.reasonUr}`);
    const d0 = ctx.weather.days?.[0];
    if (d0) {
      lines.push(
        `آج (${d0.date}): زیادہ سے زیادہ ${d0.tMaxC ?? "?"}°C، کم سے کم ${d0.tMinC ?? "?"}°C، بارش ${d0.precipMm ?? "?"} ملی میٹر (امکان ${d0.precipProbPct ?? "?"}٪)۔`,
      );
    }
  } else {
    lines.push(
      `موسم کی معلومات ابھی دستیاب نہیں: ${weatherUnavailable("پیش گوئی نہیں مل سکی")}`,
    );
  }
  if (ctx.soil.ok) lines.push(`مٹی (ISRIC SoilGrids): ${ctx.soil.summary ?? ""}`);
  else lines.push(`مٹی کی معلومات ابھی دستیاب نہیں: ${sent(ctx.soil.error ?? "نہیں مل سکی")}۔`);
  if (ctx.market) {
    const price = ctx.market.districtPrice ?? ctx.market.punjabAverage;
    if (price !== null) {
      lines.push(
        `منڈی (حوالہ، ${ctx.market.published} کو شائع، ${ctx.market.source}): ${ctx.market.nameUr} روپے ${price.toLocaleString()} ${ctx.market.unit}۔ یہ براہ راست ریٹ نہیں ہے — بیچنے سے پہلے اپنی منڈی سے تصدیق کریں۔`,
      );
    }
    if (ctx.market.comparisonUr) lines.push(ctx.market.comparisonUr);
  }
  if (ctx.yieldForecast) {
    const y = ctx.yieldForecast;
    lines.push(
      `${y.targetYear} کی پیداوار کا اندازہ (FAO/OWID پاکستان سیریز پر ٹرینڈ بیس لائن، RMSE ${y.rmse} ٹن/ہیکٹر): ${y.forecast} ٹن/ہیکٹر، حد ${y.bandLow}–${y.bandHigh} ٹن/ہیکٹر۔ آخری درج ${y.lastValue} ٹن/ہیکٹر (${y.lastYear})؛ 5 سال کی اوسط ${y.avg5} ٹن/ہیکٹر۔ یہ قومی اوسط ہے — آپ کے ضلع میں فرق ہو سکتا ہے۔`,
    );
  } else if (ctx.yieldUnavailableReason) {
    lines.push(`پیداوار کا اندازہ: ${ctx.yieldUnavailableReason}`);
  }
  if (ctx.planSteps.length > 0) {
    lines.push("آپ کا منصوبہ:");
    lines.push(...planLines);
  }
  return lines.join("\n");
}

/** Run the agent: Gemini first (with retries), deterministic fallback if needed. */
export async function answerQuestion(ctx: AnswerContext): Promise<AgentAnswer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      text: deterministicAnswer(ctx),
      source: "fallback",
      fallbackReason: "No Gemini API key configured — deterministic answer from live tool data.",
    };
  }
  try {
    const text = await answerWithGemini(buildPrompt(ctx), apiKey);
    return { text, source: "gemini", model: GEMINI_MODEL };
  } catch (error) {
    const status = (error as { status?: number }).status;
    const reason =
      status === 503
        ? "Gemini overloaded (HTTP 503) — deterministic answer from live tool data."
        : status === 429
          ? "Gemini rate-limited (HTTP 429) — deterministic answer from live tool data."
          : `Gemini unavailable (${(error as Error).message.slice(0, 120)}) — deterministic answer from live tool data.`;
    return { text: deterministicAnswer(ctx), source: "fallback", fallbackReason: reason };
  }
}
