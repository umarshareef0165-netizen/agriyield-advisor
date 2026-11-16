/**
 * Firebase AI Logic — hybrid inference for AgriYield Advisor (#BuildHybridAI).
 * ---------------------------------------------------------------------------
 * Adapted from the draft scaffold in
 * ~/workspace/build-hybrid-ai/scaffold/firebase-ai-logic.ts, updated to the
 * installed Firebase JS SDK v13.4.0 API:
 *  - Hybrid models are configured with `inCloudParams` / `onDeviceParams`,
 *    NOT a top-level `model` (v13 ignores a top-level `model` in hybrid
 *    mode and logs a warning). The on-device model is Gemini Nano via the
 *    browser Prompt API — it has no model-name parameter.
 *  - `initializeDeviceModel()` returns a Promise in v13.
 *  - The response reports `inferenceSource` as "on_device" | "in_cloud"
 *    (see the exported `InferenceSource` const), NOT "ON_DEVICE".
 *  - App Check is NOT initialised here: in v13 `initializeAppCheck`
 *    requires a provider, and there is no real Firebase project yet.
 *    When the real project exists, add a debug token for localhost and a
 *    reCAPTCHA Enterprise provider for production (see "Still needed" in
 *    the report). Until then every function below fails closed and the app
 *    keeps working on the server-side ask flow.
 *
 * STATUS: PLACEHOLDER CONFIG — no real Firebase project exists yet.
 * `isFirebaseConfigured()` is false until the config below is filled in
 * from the Firebase console (public config values only — never a secret
 * key). All hybrid features (hybrid answers, spoken answers, plan
 * pictures) stay off until then, and the UI says so honestly instead of
 * pretending they work.
 *
 * House rules (see AGENTS.md) still apply: honesty first — every number
 * shown must come from a named source; the agent is read-only; the
 * deterministic fallback stays as the last resort and is always labelled.
 * Prompts are built ONLY from tool results already returned for this
 * question — never let the model invent numbers.
 */
import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  type GenerativeModel,
} from "firebase/ai";
import type { AskResult } from "./orchestrate";

/** Cloud fallback model for hybrid text (also the DATANOVA server model). */
export const HYBRID_CLOUD_MODEL = "gemini-3.8-flash";
/** Cloud-only TTS model: spoken Urdu answers. No on-device TTS exists. */
export const TTS_MODEL = "gemini-3.8-flash-tts";
/** Cloud-only image model: Nano Banana weekly-plan visuals. */
export const IMAGE_MODEL = "gemini-nano-banana-2.1";

/**
 * TODO: fill from the Firebase console (Project settings > Your apps >
 * Web app) once the real project exists. PLACEHOLDER values — the app
 * treats these as "not configured" (see isFirebaseConfigured).
 */
const firebaseConfig = {
  apiKey: "FIREBASE_WEB_API_KEY", // public config value, not a secret
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  projectId: "YOUR-PROJECT",
  storageBucket: "YOUR-PROJECT.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};

/** True only once a real Firebase project config has been filled in. */
export function isFirebaseConfigured(): boolean {
  return (
    firebaseConfig.apiKey !== "FIREBASE_WEB_API_KEY" &&
    firebaseConfig.projectId !== "YOUR-PROJECT"
  );
}

interface HybridModels {
  hybridTextModel: GenerativeModel;
  ttsModel: GenerativeModel;
  imageModel: GenerativeModel;
}

let cachedModels: HybridModels | null = null;
let initTried = false;

/**
 * Lazy, fail-closed initialisation. Returns null when the config is a
 * placeholder or anything throws — callers fall back to the server-side
 * ask flow instead of crashing. Never throws.
 */
function getModels(): HybridModels | null {
  if (!isFirebaseConfigured()) return null;
  if (initTried) return cachedModels;
  initTried = true;
  try {
    const app = initializeApp(firebaseConfig);
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    /**
     * Hybrid text model: on-device Gemini Nano when available in Chrome,
     * cloud Gemini Flash fallback otherwise. Single-turn only (on-device
     * does NOT support multi-turn chat, tools, or grounding — those fall
     * back to cloud; NEVER use ONLY_ON_DEVICE, it throws when on-device
     * is unavailable).
     */
    const hybridTextModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: HYBRID_CLOUD_MODEL },
    });
    const ttsModel = getGenerativeModel(ai, { model: TTS_MODEL });
    const imageModel = getGenerativeModel(ai, { model: IMAGE_MODEL });
    cachedModels = { hybridTextModel, ttsModel, imageModel };
  } catch {
    cachedModels = null;
  }
  return cachedModels;
}

/**
 * MUST be called after/on a user interaction (e.g. the Ask button click)
 * and BEFORE any request to the hybrid model. Shows download progress for
 * the on-device model on first use. Safe no-op when Firebase is not
 * configured; never throws (on-device unavailable just means the cloud
 * fallback will serve the request).
 */
export async function initDeviceModel(
  onProgress?: (pct: number) => void,
): Promise<void> {
  const models = getModels();
  if (!models) return;
  try {
    await models.hybridTextModel.initializeDeviceModel((val: number) =>
      onProgress?.(Math.round(val * 10000) / 100),
    );
  } catch {
    // On-device model unavailable — PREFER_ON_DEVICE falls back to cloud.
  }
}

export type HybridInferenceSource = "ON_DEVICE" | "IN_CLOUD" | "UNKNOWN";

/**
 * Single-turn answer synthesis through the hybrid model. `prompt` must be
 * built ONLY from the tool results gathered server-side (see
 * buildHybridPrompt) — never let the model invent numbers. Returns the
 * text plus where it ran, so the UI can label it honestly ("Answered on
 * your device" / "Answered in the cloud").
 */
export async function synthesizeAnswer(prompt: string): Promise<{
  text: string;
  source: HybridInferenceSource;
}> {
  const models = getModels();
  if (!models) {
    throw new Error(
      "Firebase AI Logic is not configured — fill in the Firebase project config to enable hybrid answers.",
    );
  }
  const result = await models.hybridTextModel.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) throw new Error("Hybrid model returned an empty answer.");
  // The SDK reports which path served the request; read it from the
  // response. Absent value means unknown — never guess.
  const raw = result.response.inferenceSource;
  const source: HybridInferenceSource =
    raw === InferenceSource.ON_DEVICE
      ? "ON_DEVICE"
      : raw === InferenceSource.IN_CLOUD
        ? "IN_CLOUD"
        : "UNKNOWN";
  return { text, source };
}

/**
 * Speak an answer in Urdu. Returns raw PCM audio bytes (24 kHz, 16-bit
 * mono) for playback via AudioContext. Keep answers short: TTS input is
 * capped at 8,192 tokens. Cloud-only — needs billing/quota beyond the
 * free tier.
 */
export async function speakUrdu(text: string): Promise<ArrayBuffer> {
  const models = getModels();
  if (!models) {
    throw new Error(
      "Firebase AI Logic is not configured — spoken answers need a Firebase project and quota.",
    );
  }
  const result = await models.ttsModel.generateContent({
    contents: [{ role: "user", parts: [{ type: "text", text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
    },
  });
  const part = result.response.candidates?.[0]?.content?.parts?.find((p) => {
    const inline = (p as { inlineData?: { mimeType?: string } }).inlineData;
    return inline?.mimeType?.startsWith("audio/");
  }) as { inlineData?: { data?: string } } | undefined;
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error("TTS returned no audio.");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Generate a weekly-plan visual card. Cloud-only, billed — keep optional
 * so the app works fully without the quota account. `prompt` must
 * describe only facts already in the answer (crop, irrigation days,
 * water need) — never invent figures for the image.
 */
export async function generatePlanImage(prompt: string): Promise<string> {
  const models = getModels();
  if (!models) {
    throw new Error(
      "Firebase AI Logic is not configured — plan pictures need a Firebase project and quota.",
    );
  }
  const result = await models.imageModel.generateContent(prompt);
  const part = result.response.candidates?.[0]?.content?.parts?.find((p) => {
    const inline = (p as { inlineData?: { mimeType?: string } }).inlineData;
    return inline?.mimeType?.startsWith("image/");
  }) as { inlineData?: { data?: string; mimeType?: string } } | undefined;
  if (!part?.inlineData?.data) {
    throw new Error("Image model returned no image.");
  }
  return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
}

function languageName(language: AskResult["language"]): string {
  return language === "ur"
    ? "Urdu script (اردو)"
    : language === "roman"
      ? "Roman Urdu (Latin script)"
      : "English";
}

/**
 * Build the grounded hybrid prompt from an AskResult — the same cited
 * facts the server already gathered (weather, soil, market, yield, water
 * need, plan). No numbers enter the prompt except those in the result,
 * so the hybrid model cannot invent a figure the tools did not return.
 */
export function buildHybridPrompt(result: AskResult): string {
  const facts = result.citations
    .map((c) => `- ${c.label}: ${c.detail} (Source: ${c.source})`)
    .join("\n");
  const plan = result.plan
    .map(
      (s) =>
        `- ${s.date}: ${s.titleEn} — ${s.detailEn} (Basis: ${s.basis})`,
    )
    .join("\n");
  return [
    "You are AgriYield Advisor, an AI data agent for smallholder farmers in Punjab, Pakistan.",
    `Answer the farmer's question in ${languageName(result.language)}. Keep it short, plain, and actionable — what to do, when, and why.`,
    "STRICT RULES:",
    "1. Use ONLY the numbers in the CITED FACTS below. Never invent a number, price, date, or yield.",
    "2. Cite the source of every figure you use (Open-Meteo, SoilGrids, AMIS Punjab reference prices, FAO/OWID yield series).",
    "3. If a fact is missing from the list, say so plainly and give only what is known — never fill the gap with a guess.",
    "4. Market prices are REFERENCE prices from the published date, not live — say so if you mention them.",
    "5. The yield forecast is a statistical trend baseline with an uncertainty band — always give the band, never a single magic number.",
    "6. A revenue figure is GROSS revenue BEFORE costs — always say so, and give its range, never a single promised income.",
    "",
    `Farmer's question: ${result.question}`,
    `District: ${result.district.nameEn} (${result.district.nameUr}). Crop: ${result.cropNameEn} (${result.cropNameUr}).`,
    "",
    "CITED FACTS (tool results gathered for this question):",
    facts || "No cited facts were returned.",
    "",
    "PLAN (dated steps):",
    plan || "No plan steps were returned.",
    "",
    "Answer now, in the farmer's language, with citations after each figure.",
  ].join("\n");
}

/**
 * Build the image prompt for the weekly-plan visual from facts already
 * in the answer: crop, district, dated plan steps, and the water need
 * when the tools computed one. Nothing is invented for the picture.
 */
export function buildPlanImagePrompt(result: AskResult): string {
  const steps = result.plan
    .map((s) => `${s.date}: ${s.titleEn} — ${s.detailEn}`)
    .join("; ");
  const water = result.citations.find((c) =>
    c.label.startsWith("Irrigation water need"),
  );
  const lines = [
    `A simple flat illustration card for a farmer's weekly plan, no text errors, no numbers except those listed here.`,
    `Crop: ${result.cropNameEn}. District: ${result.district.nameEn}, Punjab, Pakistan.`,
    steps ? `Weekly plan: ${steps}.` : "Weekly plan: as in the written answer.",
  ];
  if (water) lines.push(`Water need shown on the card: ${water.detail}.`);
  lines.push(
    "Style: warm, clear, easy to read at a glance on a phone; green fields, a small water drop icon, and a calendar.",
  );
  return lines.join(" ");
}
