"use client";

import { useEffect, useRef, useState } from "react";
import { DISTRICTS } from "@/lib/districts";
import { waterNeed } from "@/lib/weather";
import {
  buildHybridPrompt,
  buildPlanImagePrompt,
  generatePlanImage,
  initDeviceModel,
  isFirebaseConfigured,
  speakUrdu,
  synthesizeAnswer,
  type HybridInferenceSource,
} from "@/lib/firebase-ai";
import type { AskResult } from "@/lib/orchestrate";
import type { CropKey } from "@/lib/intent";
import type { CropComparison } from "@/lib/compare";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | SpeechRecognitionCtor
    | undefined;
  return ctor ?? null;
}

type Lang = "ur" | "en";

const CROPS: Array<{ key: CropKey; ur: string; en: string }> = [
  { key: "wheat", ur: "گندم", en: "Wheat" },
  { key: "rice", ur: "چاول", en: "Rice" },
  { key: "maize", ur: "مکئی", en: "Maize" },
  { key: "cotton", ur: "کپاس", en: "Cotton" },
  { key: "sugarcane", ur: "گنا", en: "Sugarcane" },
];

const EXAMPLES_UR = [
  "اس ہفتے گندم کو پانی کب دوں؟",
  "گندم کب بوؤں؟",
  "فیصل آباد میں گندم کا ریٹ کیا ہے؟",
  "اس سال گندم کی پیداوار کتنی ہوگی؟",
];
const EXAMPLES_EN = [
  "When should I irrigate my wheat this week?",
  "When should I sow wheat?",
  "What is the wheat rate in Faisalabad?",
  "What will the wheat yield be this year?",
];

const STR: Record<
  Lang,
  Record<string, string>
> = {
  ur: {
    title: "ایگری ییلڈ ایڈوائزر",
    subtitle:
      "پاکستان کے چھوٹے کسانوں کے لیے اردو میں AI مشیر — موسم، مٹی، منڈی اور پیداوار، ہر نمبر حوالے کے ساتھ۔",
    district: "ضلع",
    crop: "فصل",
    sowingDate: "بوائی کی تاریخ (اختیاری)",
    question: "اپنا سوال لکھیں",
    questionPh: "مثال: اس ہفتے گندم کو پانی کب دوں؟",
    ask: "جواب پوچھیں",
    asking: "جواب تیار ہو رہا ہے…",
    examples: "مثالیں:",
    answer: "جواب",
    citations: "حوالے",
    plan: "بوائی اور پانی کا منصوبہ",
    weather: "موسم — اگلے 7 دن",
    soil: "مٹی (0–5 سینٹی میٹر)",
    market: "منڈی کی قیمتیں",
    yield: "پیداوار کا اندازہ",
    live: "براہ راست",
    reference: "حوالہ — براہ راست نہیں",
    baseline: "بیس لائن ماڈل",
    gemini: "Gemini AI جواب",
    fallback: "طے شدہ جواب (AI دستیاب نہیں)",
    failed: "سوال کا جواب نہیں مل سکا۔ دوبارہ کوشش کریں۔",
    date: "تاریخ",
    max: "زیادہ سے زیادہ",
    min: "کم سے کم",
    rain: "بارش",
    rainChance: "امکان",
    humidity: "نمی",
    wind: "ہوا",
    et0: "ET0",
    waterNeed: "پانی کی ضرورت — اگلے 7 دن",
    revenue: "مجموعی آمدنی کا اندازہ (اخراجات سے پہلے)",
    compare: "فصلوں کا موازنہ",
    compareBtn: "تینوں فصلوں کا موازنہ دیکھیں",
    comparing: "موازنہ تیار ہو رہا ہے…",
    backtest: "بیک ٹیسٹ",
    methodsTitle: "طریقہ اور حدود — ہر نمبر کا ماخذ",
    mic: "بول کر پوچھیں",
    listening: "سن رہا ہوں… بولیں",
    micUnsupported: "اس براؤزر میں بول کر پوچھنا دستیاب نہیں — لکھ کر پوچھیں۔",
    listen: "🔊 سنو",
    stop: "⏹ روکو",
    ttsUnavailable:
      "بول کر سنانا ابھی دستیاب نہیں — اس کے لیے Firebase پروجیکٹ اور کوٹہ چاہیے۔",
    hybridWorking: "ہائبرڈ جواب تیار ہو رہا ہے…",
    hybridUnavailable:
      "ہائبرڈ جواب ابھی دستیاب نہیں — Firebase پروجیکٹ تیار نہیں ہے۔ نیچے سرور جواب موجود ہے۔",
    onDevice: "📱 آپ کے آلے پر جواب",
    inCloud: "☁️ کلاؤڈ میں جواب",
    hybridUnknown: "ہائبرڈ جواب",
    planImageBtn: "🖼️ ہفتے کا منصوبہ — تصویر بنائیں",
    planImageWorking: "تصویر بن رہی ہے…",
    planImageError:
      "تصویر ابھی نہیں بن سکی — اس کے لیے Firebase پروجیکٹ اور کوٹہ چاہیے۔",
    planImageDownload: "تصویر ڈاؤن لوڈ کریں",
    diagTitle: "تصویر سے بیماری کی شناخت",
    diagDesc:
      "متاثرہ پودے کی واضح تصویر لگائیں — AI مدد سے شناخت بتائے گا۔ یہ لیب ٹیسٹ نہیں ہے۔",
    diagUpload: "تصویر چنیں",
    diagBtn: "تصویر سے شناخت کریں",
    diagWorking: "تصویر دیکھی جا رہی ہے…",
    symTitle: "علامات چیکر — بیماری پہچانیں",
    symDesc:
      "فصل چنیں، جو علامات نظر آئیں ان پر نشان لگائیں — مماثل بیماریاں ترتیب سے ملیں گی۔",
    symBtn: "بیماریاں دیکھیں",
    symWorking: "ملان ہو رہا ہے…",
    symNone: "کوئی بیماری ان علامات سے نہیں ملی — تصویر سے شناخت آزمائیں یا زرعی دفتر سے پوچھیں۔",
    safetyTitle: "زہریلی دوا — حفاظت پہلے",
    safetyBanned: "ممنوعہ دوائیں (پاکستان)",
    safetyPaddy: "دھان پر پابندی (پنجاب، 2025)",
    safetyFake: "جعلی دوا کیسے پہچانیں",
    safetyStorage: "ذخیرہ اور تلفی",
    safetyChild: "بچے اور جانور",
    fertTitle: "کھاد کیلکولیٹر",
    fertAcres: "ایکڑ",
    fertBtn: "کھاد دیکھیں",
    fertWorking: "حساب ہو رہا ہے…",
    sprayTitle: "اسپرے کا بہترین وقت — اگلے 48 گھنٹے",
    sprayBtn: "اسپرے کا وقت دیکھیں",
    sprayWorking: "موسم دیکھا جا رہا ہے…",
    sprayNone: "اگلے 48 گھنٹوں میں کوئی موزوں گھنٹہ نہیں — خشک، پرسکون وقت کا انتظار کریں۔",
    seasonalTitle: "موسمی نگرانی — اس مہینے کیا دیکھیں",
    perLabel: "لیبل کے مطابق",
    noCure: "اس کا کوئی کیمیائی علاج نہیں — دوا صرف کیڑے (وائرس پھیلانے والے) کو کنٹرول کرتی ہے۔",
    confidence: "اعتماد",
    treatment: "علاج",
    organic: "دیسی / نامیاتی متبادل",
    matched: "مماثل علامات",
    property: "خاصیت",
    value: "قدر",
    aboutTitle: "اس ایپ کے بارے میں",
    about:
      "AgriYield Advisor ایک AI ڈیٹا ایجنٹ ہے جو DATANOVA 2026 گلوبل ڈیٹا تھون (AI/ML ٹریک) کے لیے بنایا گیا ہے۔ ایجنٹ صرف پڑھتا ہے — کچھ بدلتا نہیں۔ موسم Open-Meteo سے براہ راست، مٹی ISRIC SoilGrids سے براہ راست، منڈی کی قیمتیں AMIS پنجاب کی شائع شدہ رپورٹوں (2–3 نومبر 2026) سے حوالے کے طور پر، اور پیداوار کا اندازہ FAO/OWID پاکستان سیریز (1961–2024) پر فٹ کیے گئے ٹرینڈ ماڈل سے ہے۔ اگر کوئی ذریعہ دستیاب نہ ہو تو جواب صاف کہتا ہے — اندازہ نہیں لگاتا۔",
    builtBy:
      "بنایا: عمر شریف — بی ایس سی ایس (آخری سال)، زرعی یونیورسٹی فیصل آباد، پاکستان۔",
  },
  en: {
    title: "AgriYield Advisor",
    subtitle:
      "An Urdu-first AI advisor for Pakistan's smallholder farmers — weather, soil, market and yield, every number cited.",
    district: "District",
    crop: "Crop",
    sowingDate: "Sowing date (optional)",
    question: "Ask your question",
    questionPh: "Example: When should I irrigate my wheat this week?",
    ask: "Ask",
    asking: "Preparing your answer…",
    examples: "Examples:",
    answer: "Answer",
    citations: "Sources",
    plan: "Sowing & irrigation plan",
    weather: "Weather — next 7 days",
    soil: "Soil (0–5 cm)",
    market: "Market prices",
    yield: "Yield forecast",
    live: "Live",
    reference: "Reference — not live",
    baseline: "Baseline model",
    gemini: "Gemini AI answer",
    fallback: "Deterministic answer (AI unavailable)",
    failed: "Could not answer the question. Please try again.",
    date: "Date",
    max: "Max",
    min: "Min",
    rain: "Rain",
    rainChance: "Chance",
    humidity: "Humidity",
    wind: "Wind",
    et0: "ET0",
    waterNeed: "Irrigation water need — next 7 days",
    revenue: "Gross revenue estimate (before costs)",
    compare: "Compare crops",
    compareBtn: "Compare all three crops",
    comparing: "Preparing the comparison…",
    backtest: "Backtest",
    methodsTitle: "Method & limits — where every number comes from",
    mic: "Ask by voice",
    listening: "Listening… speak now",
    micUnsupported: "Voice input is not available in this browser — please type instead.",
    listen: "🔊 Listen",
    stop: "⏹ Stop",
    ttsUnavailable:
      "Spoken answers are not available yet — they need a Firebase project and quota.",
    hybridWorking: "Preparing the hybrid answer…",
    hybridUnavailable:
      "Hybrid answers are not available yet — the Firebase project is not set up. The server answer below still works.",
    onDevice: "📱 Answered on your device",
    inCloud: "☁️ Answered in the cloud",
    hybridUnknown: "Hybrid answer",
    planImageBtn: "🖼️ Make a weekly-plan picture",
    planImageWorking: "Making the picture…",
    planImageError:
      "The picture could not be made yet — it needs a Firebase project and quota.",
    planImageDownload: "Download the picture",
    diagTitle: "Photo diagnosis — identify the disease",
    diagDesc:
      "Upload a clear photo of the affected plant — AI-assisted identification. This is NOT a lab test.",
    diagUpload: "Choose a photo",
    diagBtn: "Diagnose from photo",
    diagWorking: "Looking at the photo…",
    symTitle: "Symptom checker — identify the disease",
    symDesc:
      "Pick a crop, tick the symptoms you see — matching diseases are ranked.",
    symBtn: "Show matching diseases",
    symWorking: "Matching…",
    symNone: "No disease matches those symptoms — try photo diagnosis or ask the agriculture office.",
    safetyTitle: "Pesticide safety — safety first",
    safetyBanned: "Banned pesticides (Pakistan)",
    safetyPaddy: "Paddy ban (Punjab, 2025)",
    safetyFake: "How to spot a fake pesticide",
    safetyStorage: "Storage & disposal",
    safetyChild: "Children & animals",
    fertTitle: "Fertilizer calculator",
    fertAcres: "Acres",
    fertBtn: "Calculate fertilizer",
    fertWorking: "Calculating…",
    sprayTitle: "Best spray time — next 48 hours",
    sprayBtn: "Show spray window",
    sprayWorking: "Checking the weather…",
    sprayNone: "No suitable hour in the next 48 hours — wait for a dry, calm slot.",
    seasonalTitle: "Seasonal watch — what to check this month",
    perLabel: "per label",
    noCure: "There is NO chemical cure for this — the pesticide controls only the insect vector.",
    confidence: "Confidence",
    treatment: "Treatment",
    organic: "Organic alternative",
    matched: "Matched symptoms",
    property: "Property",
    value: "Value",
    aboutTitle: "About this app",
    about:
      "AgriYield Advisor is an AI data agent built for the DATANOVA 2026 Global Data-thon (AI/ML track). The agent is read-only — it changes nothing. Weather is live from Open-Meteo, soil is live from ISRIC SoilGrids, market prices are a dated reference from AMIS Punjab reports (2–3 Nov 2026), and the yield forecast is a trend model fitted on the FAO/OWID Pakistan series (1961–2024). If a source is unavailable, the answer says so plainly — it never guesses.",
    builtBy:
      "Built by Umar Shareef — BSCS (Final Year), University of Agriculture Faisalabad, Pakistan.",
  },
};

/**
 * Play raw PCM audio (24 kHz, 16-bit mono) from Gemini TTS via an
 * AudioContext. Returns a stop handle; the context is closed on end or
 * on stop. Browser-only — called from the speak button (a user gesture).
 */
function playPcm(
  bytes: ArrayBuffer,
  onEnded: () => void,
): { stop: () => void } {
  const ctx = new AudioContext({ sampleRate: 24000 });
  const int16 = new Int16Array(bytes);
  const buf = ctx.createBuffer(1, int16.length, 24000);
  const channel = buf.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.onended = () => {
    void ctx.close().catch(() => undefined);
    onEnded();
  };
  src.start();
  return {
    stop: () => {
      try {
        src.stop();
      } catch {
        // Already stopped — onended still fires and closes the context.
      }
      void ctx.close().catch(() => undefined);
    },
  };
}

interface DiagApi {
  available: boolean;
  reasonEn?: string;
  reasonUr?: string;
  source?: string;
  diagnosis?: {
    diseaseEn: string;
    diseaseUr: string;
    confidence: string;
    symptomsObserved: string[];
    treatment: string[];
    pesticide: {
      activeIngredient: string;
      whoClass: string;
      ppe: string[];
      firstAid: string;
    };
    organicAlternative: string;
    disclaimer: string;
  };
}

interface SymptomOption {
  id: string;
  diseaseId: string;
  textEn: string;
  textUr: string;
}

interface SymptomMatchApi {
  diseaseId: string;
  nameEn: string;
  nameUr: string;
  matchedCount: number;
  totalSymptoms: number;
  matchedSymptomsEn: string[];
  treatmentEn: string[];
  treatmentUr: string[];
  organicAlternativeEn: string;
  organicAlternativeUr: string;
  pesticide: {
    activeIngredient: string;
    whoClass: string;
    ppeEn: string[];
    firstAidEn: string;
    firstAidUr: string;
  };
  note: string | null;
  source: string;
}

interface FertApi {
  available: boolean;
  reasonEn?: string;
  reasonUr?: string;
  ureaBags?: number;
  dapBags?: number;
  mopBags?: number;
  basis?: string;
  standardCase?: string;
  timing?: string | null;
  source?: string;
  soilNoteEn?: string;
  soilNoteUr?: string;
}

interface SprayApi {
  hourly: {
    windows: Array<{ start: string; end: string; hours: number }>;
    best: { start: string; end: string; hours: number } | null;
    method: string;
    suitableHours: number;
    hoursChecked: number;
  } | null;
  hourlyError?: string;
  dayGuide: {
    bestDay?: string | null;
    bestDaySuitable?: boolean;
    recommendedHours?: string;
    reasonEn?: string;
    reasonUr?: string;
    error?: string;
  } | null;
}

interface SeasonalApi {
  monthEn: string;
  monthUr: string;
  entries: Array<{
    crop: string;
    pestOrDisease: string;
    watchEn: string;
    watchUr: string;
    generalGuidance: boolean;
  }>;
}

interface SafetyApi {
  banned: Array<{ activeIngredient: string; source: string; status: string }>;
  bannedCaveatEn: string;
  bannedCaveatUr: string;
  paddyBanPunjab2025: {
    activeIngredients: string[];
    scope: string;
    note: string;
    source: string;
  };
  fakeChecks: { en: string[]; ur: string[] };
  storage: { en: string[]; ur: string[] };
  disposal: { en: string[]; ur: string[] };
  childAnimalSafety: { en: string[]; ur: string[] };
}

const SYMPTOM_CROPS: Array<{ key: string; ur: string; en: string }> = [
  ...CROPS,
  { key: "tomato", ur: "ٹماٹر", en: "Tomato" },
];

export default function Home() {
  const [lang, setLang] = useState<Lang>("ur");
  const [district, setDistrict] = useState("faisalabad");
  const [crop, setCrop] = useState<CropKey>("wheat");
  const [sowingDate, setSowingDate] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<CropComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  // #BuildHybridAI — hybrid answer (on-device first, cloud fallback).
  const [hybridAnswer, setHybridAnswer] = useState<{
    text: string;
    source: HybridInferenceSource;
  } | null>(null);
  const [hybridStatus, setHybridStatus] = useState<
    "idle" | "working" | "done" | "unavailable"
  >("idle");
  const [deviceProgress, setDeviceProgress] = useState<number | null>(null);
  // #BuildHybridAI — spoken answers (Gemini TTS, cloud-only).
  const [speaking, setSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioStopRef = useRef<(() => void) | null>(null);
  // #BuildHybridAI — weekly-plan picture (Nano Banana, cloud-only).
  const [planImage, setPlanImage] = useState<string | null>(null);
  const [planImageStatus, setPlanImageStatus] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [planImageError, setPlanImageError] = useState<string | null>(null);
  // Photo diagnosis + symptom checker + safety + fertilizer + spray + seasonal.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagApi | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [symCrop, setSymCrop] = useState("wheat");
  const [symOptions, setSymOptions] = useState<SymptomOption[]>([]);
  const [symSelected, setSymSelected] = useState<string[]>([]);
  const [symMatches, setSymMatches] = useState<SymptomMatchApi[] | null>(null);
  const [symLoading, setSymLoading] = useState(false);
  const [safety, setSafety] = useState<SafetyApi | null>(null);
  const [fertCrop, setFertCrop] = useState("wheat");
  const [fertAcres, setFertAcres] = useState("5");
  const [fertSoilN, setFertSoilN] = useState("");
  const [fertSoilPh, setFertSoilPh] = useState("");
  const [fertResult, setFertResult] = useState<FertApi | null>(null);
  const [fertLoading, setFertLoading] = useState(false);
  const [sprayResult, setSprayResult] = useState<SprayApi | null>(null);
  const [sprayLoading, setSprayLoading] = useState(false);
  const [sprayError, setSprayError] = useState<string | null>(null);
  const [seasonMonth, setSeasonMonth] = useState(() => new Date().getMonth() + 1);
  const [seasonal, setSeasonal] = useState<SeasonalApi | null>(null);

  useEffect(() => {
    // Mount-only feature detection: SpeechRecognition exists only in the
    // browser, so support cannot be known at SSR time. One setState, once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(speechRecognitionCtor() !== null);
    // Pesticide safety guide (local verified dataset) — loaded once.
    void fetch("/api/safety")
      .then((r) => r.json())
      .then((d) => setSafety(d as SafetyApi))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Symptom list for the chosen crop.
    void fetch(`/api/symptoms?crop=${symCrop}`)
      .then((r) => r.json())
      .then((d) => setSymOptions((d.symptoms ?? []) as SymptomOption[]))
      .catch(() => setSymOptions([]));
  }, [symCrop]);

  useEffect(() => {
    void fetch(`/api/seasonal?month=${seasonMonth}`)
      .then((r) => r.json())
      .then((d) => setSeasonal(d as SeasonalApi))
      .catch(() => setSeasonal(null));
  }, [seasonMonth]);

  function listen() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setMicError(t.micUnsupported);
      return;
    }
    setMicError(null);
    const rec = new Ctor();
    rec.lang = lang === "ur" ? "ur-PK" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) setQuestion(text);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") {
        setMicError(
          lang === "ur"
            ? "مائیک کی اجازت نہیں ملی — براؤزر کی سیٹنگ سے اجازت دیں یا لکھ کر پوچھیں۔"
            : "Microphone permission was denied — allow it in browser settings or type instead.",
        );
      }
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function loadCompare() {
    setCompareLoading(true);
    setCompare(null);
    try {
      const res = await fetch(`/api/compare?district=${district}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.failed);
      setCompare(data as CropComparison);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCompareLoading(false);
    }
  }

  async function diagnose() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setDiagError(
        lang === "ur"
          ? "پہلے تصویر چنیں۔"
          : "Choose a photo first.",
      );
      return;
    }
    setDiagLoading(true);
    setDiagError(null);
    setDiagResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("crop", crop);
      form.append("district", district);
      const res = await fetch("/api/diagnose", { method: "POST", body: form });
      const data = (await res.json()) as DiagApi;
      if (!res.ok) throw new Error(data.reasonEn ?? t.failed);
      setDiagResult(data);
    } catch (e) {
      setDiagError((e as Error).message);
    } finally {
      setDiagLoading(false);
    }
  }

  async function checkSymptoms() {
    if (symSelected.length === 0) return;
    setSymLoading(true);
    try {
      const res = await fetch(
        `/api/symptoms?crop=${symCrop}&symptoms=${encodeURIComponent(symSelected.join(","))}`,
      );
      const data = await res.json();
      setSymMatches((data.matches ?? []) as SymptomMatchApi[]);
    } catch {
      setSymMatches([]);
    } finally {
      setSymLoading(false);
    }
  }

  async function calcFertilizer() {
    setFertLoading(true);
    try {
      const q = new URLSearchParams({ crop: fertCrop, acres: fertAcres });
      if (fertSoilN) q.set("soilN", fertSoilN);
      if (fertSoilPh) q.set("soilPh", fertSoilPh);
      const res = await fetch(`/api/fertilizer?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.failed);
      setFertResult(data as FertApi);
    } catch (e) {
      setFertResult({
        available: false,
        reasonEn: (e as Error).message,
        reasonUr: (e as Error).message,
      });
    } finally {
      setFertLoading(false);
    }
  }

  async function loadSpray() {
    setSprayLoading(true);
    setSprayError(null);
    try {
      const res = await fetch(`/api/spray?district=${district}`);
      const data = await res.json();
      setSprayResult(data as SprayApi);
    } catch (e) {
      setSprayError((e as Error).message);
    } finally {
      setSprayLoading(false);
    }
  }

  const t = STR[lang];
  const examples = lang === "ur" ? EXAMPLES_UR : EXAMPLES_EN;

  function stopSpeaking() {
    audioStopRef.current?.();
    audioStopRef.current = null;
    setSpeaking(false);
  }

  /** Speak the shown answer aloud in Urdu (Gemini TTS, cloud-only). */
  async function speak() {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const text = (hybridAnswer?.text ?? result?.answer.text ?? "").trim();
    if (!text) return;
    setTtsError(null);
    setSpeaking(true);
    try {
      const pcm = await speakUrdu(text);
      audioStopRef.current = playPcm(pcm, () => setSpeaking(false)).stop;
    } catch (e) {
      setSpeaking(false);
      setTtsError((e as Error).message);
    }
  }

  /** Generate the weekly-plan picture (Nano Banana, cloud-only, optional). */
  async function makePlanImage() {
    if (!result) return;
    setPlanImageStatus("working");
    setPlanImageError(null);
    try {
      const url = await generatePlanImage(buildPlanImagePrompt(result));
      setPlanImage(url);
      setPlanImageStatus("done");
    } catch (e) {
      setPlanImageStatus("error");
      setPlanImageError((e as Error).message);
    }
  }

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    stopSpeaking();
    setLoading(true);
    setError(null);
    setResult(null);
    setHybridAnswer(null);
    setHybridStatus("idle");
    setDeviceProgress(null);
    setTtsError(null);
    setPlanImage(null);
    setPlanImageStatus("idle");
    setPlanImageError(null);
    // User gesture: warm up the on-device model (safe no-op while
    // Firebase is not configured). Must run before any hybrid request.
    if (isFirebaseConfigured()) {
      void initDeviceModel((pct) => setDeviceProgress(pct));
    }
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          district,
          crop,
          sowingDate: sowingDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.failed);
      const askResult = data as AskResult;
      setResult(askResult);
      // Hybrid re-synthesis from the same cited facts (client-side,
      // on-device first, cloud fallback). Any failure keeps the server
      // answer — the app stays fully usable without a Firebase project.
      if (isFirebaseConfigured()) {
        setHybridStatus("working");
        try {
          const hybrid = await synthesizeAnswer(
            buildHybridPrompt(askResult),
          );
          setHybridAnswer(hybrid);
          setHybridStatus("done");
        } catch {
          setHybridStatus("unavailable");
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const w = result?.tools.weather;
  const water = w?.days ? waterNeed(w.days) : null;
  const s = result?.tools.soil;
  const m = result?.tools.market.data;
  const y = result?.tools.yield.data;
  const maxYield = y ? Math.max(...y.seriesLast10.map((p) => p.yield_t_ha)) : 0;

  return (
    <div dir={lang === "ur" ? "rtl" : "ltr"}>
      <header className="hero">
        <div className="container">
          <h1>{t.title}</h1>
          <p className="sub">{t.subtitle}</p>
          <div className="lang-toggle">
            <button
              className={lang === "ur" ? "active" : ""}
              onClick={() => setLang("ur")}
            >
              اردو
            </button>
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
            >
              English
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="card">
          <div className="row">
            <div>
              <label htmlFor="district">{t.district}</label>
              <select
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {DISTRICTS.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {lang === "ur" ? d.nameUr : d.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="crop">{t.crop}</label>
              <select
                id="crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value as CropKey)}
              >
                {CROPS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {lang === "ur" ? c.ur : c.en}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label htmlFor="sowing">{t.sowingDate}</label>
          <input
            id="sowing"
            type="date"
            value={sowingDate}
            onChange={(e) => setSowingDate(e.target.value)}
          />
          <label htmlFor="q">{t.question}</label>
          <textarea
            id="q"
            value={question}
            placeholder={t.questionPh}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="chips">
            {micSupported && (
              <button type="button" onClick={listen} disabled={listening}>
                🎙️ {listening ? t.listening : t.mic}
              </button>
            )}
            <span className="muted">{t.examples}</span>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuestion(ex);
                  ask(ex);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
          <button className="ask" disabled={loading} onClick={() => ask()}>
            {loading ? t.asking : t.ask}
          </button>
          {micError && <p className="error">{micError}</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="card">
          <h2>{t.compare}</h2>
          <p className="muted">
            {lang === "ur"
              ? "گندم، چاول اور مکئی — پیداوار کا اندازہ، بیک ٹیسٹ اور مجموعی آمدنی ایک ساتھ۔ بوائی کا فیصلہ کرنے سے پہلے موازنہ کریں۔"
              : "Wheat, rice and maize — yield forecast, backtest and gross revenue side by side. Compare before deciding what to sow."}
          </p>
          <button
            className="ask"
            disabled={compareLoading}
            onClick={loadCompare}
          >
            {compareLoading ? t.comparing : t.compareBtn}
          </button>
          {compare && (
            <table className="data">
              <thead>
                <tr>
                  <th>{t.crop}</th>
                  <th>
                    {compare.rows[0]?.targetYear} — t/ha
                  </th>
                  <th>{t.backtest} MAE</th>
                  <th>{t.revenue} /ha</th>
                </tr>
              </thead>
              <tbody>
                {compare.rows.map((r) => (
                  <tr key={r.crop}>
                    <td>{lang === "ur" ? r.nameUr : r.nameEn}</td>
                    <td>
                      {r.forecast} ({r.bandLow}–{r.bandHigh})
                    </td>
                    <td>{r.backtestMae} t/ha</td>
                    <td>
                      {r.revenue
                        ? `Rs. ${r.revenue.grossPerHa.toLocaleString()}`
                        : lang === "ur"
                          ? "کوئی واحد قیمت نہیں — تین اقسام"
                          : "No single price — three varieties"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {compare && <p className="muted">{compare.note}</p>}
        </section>

        {result && (
          <>
            <section className="card">
              <h2>
                {t.answer}
                {hybridAnswer ? (
                  <span
                    className={`badge ${hybridAnswer.source === "ON_DEVICE" ? "ondevice" : hybridAnswer.source === "IN_CLOUD" ? "cloud" : "hybrid"}`}
                  >
                    {hybridAnswer.source === "ON_DEVICE"
                      ? t.onDevice
                      : hybridAnswer.source === "IN_CLOUD"
                        ? t.inCloud
                        : t.hybridUnknown}
                  </span>
                ) : (
                  <span
                    className={`badge ${result.answer.source === "gemini" ? "gemini" : "fallback"}`}
                  >
                    {result.answer.source === "gemini" ? t.gemini : t.fallback}
                  </span>
                )}
              </h2>
              {hybridStatus === "working" && (
                <p className="muted">{t.hybridWorking}</p>
              )}
              {hybridStatus === "unavailable" && (
                <p className="muted">{t.hybridUnavailable}</p>
              )}
              {deviceProgress !== null && deviceProgress < 100 && (
                <p className="muted">
                  {lang === "ur"
                    ? `Device model download ho raha hai… ${deviceProgress}%`
                    : `Downloading the on-device model… ${deviceProgress}%`}
                </p>
              )}
              {result.answer.fallbackReason && (
                <p className="muted">{result.answer.fallbackReason}</p>
              )}
              <p className="answer">
                {hybridAnswer?.text ?? result.answer.text}
              </p>
              <div className="chips">
                <button type="button" onClick={speak}>
                  {speaking ? t.stop : t.listen}
                </button>
              </div>
              {ttsError && (
                <p className="error">
                  {ttsError.includes("not configured")
                    ? t.ttsUnavailable
                    : ttsError}
                </p>
              )}
              <h3>{t.citations}</h3>
              <ul className="cites">
                {result.citations.map((c, i) => (
                  <li key={i}>
                    <strong>{c.label}:</strong> {c.detail}{" "}
                    <span className="muted">({c.source})</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>{t.plan}</h2>
              <ol className="plan">
                {result.plan.map((step, i) => (
                  <li key={i}>
                    <span className="date">{step.date}</span> —{" "}
                    <strong>{lang === "ur" ? step.titleUr : step.titleEn}</strong>
                    <br />
                    {lang === "ur" ? step.detailUr : step.detailEn}
                    <br />
                    <span className="muted">{step.basis}</span>
                  </li>
                ))}
              </ol>
              <div className="chips">
                <button
                  type="button"
                  onClick={makePlanImage}
                  disabled={planImageStatus === "working"}
                >
                  {planImageStatus === "working"
                    ? t.planImageWorking
                    : t.planImageBtn}
                </button>
              </div>
              {planImageError && (
                <p className="error">
                  {planImageError.includes("not configured")
                    ? t.planImageError
                    : planImageError}
                </p>
              )}
              {planImage && (
                <div>
                  <img
                    src={planImage}
                    alt={lang === "ur" ? "ہفتے کا منصوبہ" : "Weekly plan"}
                    style={{ maxWidth: "100%", borderRadius: 12 }}
                  />
                  <p>
                    <a href={planImage} download="agriyield-weekly-plan.png">
                      {t.planImageDownload}
                    </a>
                  </p>
                </div>
              )}
            </section>

            <section className="card">
              <h2>
                {t.weather}
                <span className="badge live">{t.live}</span>
              </h2>
              {w?.status === "unavailable" ? (
                <div className="warn-box">{w.error}</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>
                        {t.max} °C
                      </th>
                      <th>
                        {t.min} °C
                      </th>
                      <th>
                        {t.rain} (mm)
                      </th>
                      <th>
                        {t.rainChance} %
                      </th>
                      <th>
                        {t.humidity} %
                      </th>
                      <th>
                        {t.wind} km/h
                      </th>
                      <th>
                        {t.et0} (mm)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {w?.days?.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.tMaxC ?? "—"}</td>
                        <td>{d.tMinC ?? "—"}</td>
                        <td>{d.precipMm ?? "—"}</td>
                        <td>{d.precipProbPct ?? "—"}</td>
                        <td>{d.humidityPct ?? "—"}</td>
                        <td>{d.windKmh ?? "—"}</td>
                        <td>{d.et0Mm ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {water && water.complete && water.netMm !== null ? (
                <div className="ref-box">
                  <strong>{t.waterNeed}:</strong>{" "}
                  {lang === "ur"
                    ? `خالص ${water.netMm} ملی میٹر (ET0 ‏${water.et0SumMm} ملی میٹر منفی بارش ${water.rainSumMm} ملی میٹر) — تقریباً ${water.litresPerAcre?.toLocaleString()} لیٹر فی ایکڑ (${water.litresPerHectare?.toLocaleString()} لیٹر فی ہیکٹر)۔ حوالہ (ET0) ضرورت — فصل کا گتانک لاگو نہیں۔`
                    : `Net ${water.netMm} mm (ET0 ${water.et0SumMm} mm minus rain ${water.rainSumMm} mm) — about ${water.litresPerAcre?.toLocaleString()} litres per acre (${water.litresPerHectare?.toLocaleString()} litres per hectare). Reference (ET0) demand — no crop coefficient applied.`}
                  <br />
                  <span className="muted">{water.method}</span>
                </div>
              ) : (
                water && (
                  <div className="warn-box">
                    {lang === "ur"
                      ? "پانی کی ضرورت نہیں نکالی جا سکی — پیش گوئی میں ET0 یا بارش کی قدریں نامکمل ہیں۔"
                      : "Water need could not be computed — ET0 or rain values are missing from the forecast."}
                  </div>
                )
              )}
              <p className="muted">Open-Meteo — {result.district.nameEn}</p>
            </section>

            <section className="card">
              <h2>
                {t.soil}
                <span className="badge live">{t.live}</span>
              </h2>
              {s?.status === "unavailable" ? (
                <div className="warn-box">{s.error}</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.property}</th>
                      <th>0–5 cm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s?.data?.properties.map((p) => (
                      <tr key={p.name}>
                        <td>
                          {p.label} ({p.unit})
                        </td>
                        <td>
                          {p.values[0]?.mean !== null &&
                          p.values[0]?.mean !== undefined
                            ? p.values[0].mean.toFixed(2)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="muted">
                ISRIC SoilGrids (250 m) — {result.district.nameEn}. “—” means
                not reported for this point.
              </p>
            </section>

            <section className="card">
              <h2>
                {t.market}
                <span className="badge ref">{t.reference}</span>
              </h2>
              {m ? (
                <>
                  <div className="ref-box">
                    {lang === "ur"
                      ? `یہ براہ راست ریٹ نہیں ہے — ${m.published} کو شائع شدہ حوالہ قیمتیں۔ بیچنے سے پہلے اپنی منڈی سے تصدیق کریں۔`
                      : `Not a live rate — reference prices published ${m.published}. Confirm at your local mandi before selling.`}
                  </div>
                  <table className="data">
                    <tbody>
                      {m.districtPrice !== null && (
                        <tr>
                          <td>
                            {result.district.nameEn} — {m.nameEn}
                          </td>
                          <td>
                            Rs. {m.districtPrice.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.punjabAverage !== null && (
                        <tr>
                          <td>Punjab average</td>
                          <td>
                            Rs. {m.punjabAverage.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.rangeLow !== null && m.rangeHigh !== null && (
                        <tr>
                          <td>Punjab range</td>
                          <td>
                            Rs. {m.rangeLow.toLocaleString()} –{" "}
                            {m.rangeHigh.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.spot !== null && (
                        <tr>
                          <td>Spot rate</td>
                          <td>
                            Rs. {m.spot.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.govtIndicative !== null && (
                        <tr>
                          <td>Govt indicative (2027 crop)</td>
                          <td>
                            Rs. {m.govtIndicative.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.varieties?.map((v) => (
                        <tr key={v.name}>
                          <td>{v.name}</td>
                          <td>
                            Rs. {v.low.toLocaleString()} –{" "}
                            {v.high.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {m.comparisonEn && (
                    <p>{lang === "ur" ? m.comparisonUr : m.comparisonEn}</p>
                  )}
                  <p className="muted">{m.source}</p>
                </>
              ) : (
                <div className="warn-box">
                  {result.tools.market.error ?? "No market data for this crop."}
                </div>
              )}
            </section>

            <section className="card">
              <h2>
                {t.yield}
                <span className="badge base">{t.baseline}</span>
              </h2>
              {y ? (
                <>
                  <p>
                    <strong>
                      {y.targetYear}: {y.forecast} t/ha
                    </strong>{" "}
                    (range {y.bandLow}–{y.bandHigh} t/ha)
                  </p>
                  <p className="muted">
                    {lang === "ur"
                      ? `طریقہ: ${y.method} نمونہ میں RMSE ${y.rmse} ٹن/ہیکٹر۔ آخری درج ${y.lastValue} ٹن/ہیکٹر (${y.lastYear})؛ 5 سال کی اوسط ${y.avg5} ٹن/ہیکٹر؛ 10 سال کی اوسط ${y.avg10} ٹن/ہیکٹر۔ یہ قومی اوسط ہے — ضلعی پیداوار مختلف ہو سکتی ہے۔`
                      : `Method: ${y.method} In-sample RMSE ${y.rmse} t/ha. Last observed ${y.lastValue} t/ha (${y.lastYear}); 5-year average ${y.avg5} t/ha; 10-year average ${y.avg10} t/ha. National average — district yields will differ.`}
                  </p>
                  <p>
                    <strong>{t.backtest} ({y.backtest.holdoutYears[0]}–
                    {y.backtest.holdoutYears[y.backtest.holdoutYears.length - 1]}):</strong>{" "}
                    {lang === "ur"
                      ? `ٹرینڈ MAE ‏${y.backtest.trendMae} ٹن/ہیکٹر — سادہ اندازہ ${y.backtest.naiveMae}، 5 سال کی اوسط ${y.backtest.avg5Mae}۔ یہ پرانی فصلوں پر جانچ ہے، مستقبل کی ضمانت نہیں۔`
                      : `Trend MAE ${y.backtest.trendMae} t/ha vs naive ${y.backtest.naiveMae} t/ha and 5-year average ${y.backtest.avg5Mae} t/ha. Tested on past seasons — not a guarantee for the future.`}
                  </p>
                  {result.revenue ? (
                    <div className="ref-box">
                      <strong>{t.revenue}:</strong>{" "}
                      {lang === "ur"
                        ? `تقریباً ${result.revenue.grossPerHa.toLocaleString()} روپے فی ہیکٹر (حد ${result.revenue.bandLowPerHa.toLocaleString()}–${result.revenue.bandHighPerHa.toLocaleString()} روپے)، ${result.revenue.priceUsed === "district" ? "ضلع" : result.revenue.priceUsed === "spot" ? "اسپاٹ" : "پنجاب کی اوسط"} حوالہ قیمت ${result.revenue.pricePer40kg.toLocaleString()} روپے فی 40 کلو (${result.revenue.published})۔ یہ منافع نہیں ہے — بیج، کھاد، پانی اور مزدوری کے اخراجات شامل نہیں۔`
                        : `About Rs. ${result.revenue.grossPerHa.toLocaleString()} per hectare (range Rs. ${result.revenue.bandLowPerHa.toLocaleString()}–${result.revenue.bandHighPerHa.toLocaleString()}), at the ${result.revenue.priceUsed} reference price of Rs. ${result.revenue.pricePer40kg.toLocaleString()} per 40 kg (${result.revenue.published}). This is not profit — seed, fertilizer, water and labour costs are not included.`}
                      <br />
                      <span className="muted">{result.revenue.method}</span>
                    </div>
                  ) : (
                    <p className="muted">
                      {lang === "ur"
                        ? "آمدنی کا اندازہ نہیں — اس فصل کی کوئی واحد حوالہ قیمت نہیں (چاول کی تین اقسام ہیں)۔"
                        : "No revenue estimate — no single reference price for this crop (rice has three varieties)."}
                    </p>
                  )}
                  <div className="bars">
                    {y.seriesLast10.map((p) => (
                      <div className="bar" key={p.year}>
                        <div
                          className="fill"
                          style={{
                            height: `${Math.max(8, (p.yield_t_ha / maxYield) * 100)}%`,
                          }}
                        />
                        <div className="lbl">{p.year}</div>
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    Pakistan {y.nameEn} yield, last 10 years (t/ha). Source:{" "}
                    {y.source}
                  </p>
                </>
              ) : (
                <div className="warn-box">
                  {result.tools.yield.error ?? "No yield forecast for this crop."}
                </div>
              )}
            </section>
          </>
        )}

        <section className="card">
          <h2>{t.diagTitle}</h2>
          <p className="muted">{t.diagDesc}</p>
          <div className="row">
            <div>
              <label htmlFor="diag-crop">{t.crop}</label>
              <select
                id="diag-crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value as CropKey)}
              >
                {CROPS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {lang === "ur" ? c.ur : c.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="diag-district">{t.district}</label>
              <select
                id="diag-district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {DISTRICTS.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {lang === "ur" ? d.nameUr : d.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label htmlFor="diag-file">{t.diagUpload}</label>
          <input
            id="diag-file"
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "block", margin: "6px 0 12px" }}
          />
          <button className="ask" disabled={diagLoading} onClick={diagnose}>
            {diagLoading ? t.diagWorking : t.diagBtn}
          </button>
          {diagError && <p className="error">{diagError}</p>}
          {diagResult && !diagResult.available && (
            <div className="warn-box">
              {lang === "ur" ? diagResult.reasonUr : diagResult.reasonEn}
            </div>
          )}
          {diagResult?.available && diagResult.diagnosis && (
            <div>
              <h3>
                {lang === "ur"
                  ? diagResult.diagnosis.diseaseUr
                  : diagResult.diagnosis.diseaseEn}
              </h3>
              <p>
                <strong>{t.confidence}:</strong>{" "}
                {diagResult.diagnosis.confidence}
                <span className="muted">
                  {" "}
                  —{" "}
                  {lang === "ur"
                    ? "فیصد نہیں، صرف کم / درمیانہ / زیادہ"
                    : "never a percentage, only low / medium / high"}
                </span>
              </p>
              <p>
                <strong>{t.treatment}:</strong>
              </p>
              <ul className="cites">
                {diagResult.diagnosis.treatment.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p>
                <strong>
                  {lang === "ur" ? "فعال جزو" : "Active ingredient"}:
                </strong>{" "}
                {diagResult.diagnosis.pesticide.activeIngredient} (WHO{" "}
                {diagResult.diagnosis.pesticide.whoClass}) —{" "}
                {lang === "ur" ? "کٹائی سے پہلے کا وقفہ" : "Pre-harvest interval"}
                : {t.perLabel};{" "}
                {lang === "ur" ? "دوبارہ داخلہ" : "Re-entry"}: {t.perLabel}
              </p>
              <p>
                <strong>{t.organic}:</strong>{" "}
                {diagResult.diagnosis.organicAlternative}
              </p>
              <div className="warn-box">
                {lang === "ur"
                  ? "صرف تصویر سے AI کی مدد سے شناخت — یہ لیب ٹیسٹ نہیں ہے۔ اسپرے سے پہلے اپنے ضلعی زرعی دفتر یا پلانٹ کلینک سے تصدیق کریں۔"
                  : "AI-assisted identification from a photo only — NOT a lab test. Confirm with your district agriculture office or a plant clinic before spraying."}
              </div>
              <p className="muted">
                {lang === "ur" ? "ماخذ" : "Source"}: Gemini ({diagResult.source}
                ) — {diagResult.diagnosis.disclaimer}
              </p>
            </div>
          )}
          <p className="muted">
            {lang === "ur"
              ? "تصویر سرور پر محفوظ نہیں ہوتی — صرف اسی وقت دیکھی جاتی ہے۔ زیادہ سے زیادہ 5 MB۔"
              : "The photo is never stored on the server — it is processed in memory only. Maximum 5 MB."}
          </p>
        </section>

        <section className="card">
          <h2>{t.symTitle}</h2>
          <p className="muted">{t.symDesc}</p>
          <label htmlFor="sym-crop">{t.crop}</label>
          <select
            id="sym-crop"
            value={symCrop}
            onChange={(e) => {
              setSymCrop(e.target.value);
              setSymSelected([]);
              setSymMatches(null);
            }}
          >
            {SYMPTOM_CROPS.map((c) => (
              <option key={c.key} value={c.key}>
                {lang === "ur" ? c.ur : c.en}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 10 }}>
            {symOptions.map((s) => (
              <label key={s.id} style={{ display: "block", margin: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={symSelected.includes(s.id)}
                  onChange={(e) =>
                    setSymSelected((prev) =>
                      e.target.checked
                        ? [...prev, s.id]
                        : prev.filter((x) => x !== s.id),
                    )
                  }
                />{" "}
                {lang === "ur" ? s.textUr : s.textEn}
              </label>
            ))}
          </div>
          <button
            className="ask"
            disabled={symLoading || symSelected.length === 0}
            onClick={checkSymptoms}
          >
            {symLoading ? t.symWorking : t.symBtn}
          </button>
          {symMatches !== null && symMatches.length === 0 && (
            <div className="warn-box">{t.symNone}</div>
          )}
          {symMatches?.map((m) => (
            <div key={m.diseaseId} style={{ marginTop: 12 }}>
              <h3>
                {lang === "ur" ? m.nameUr : m.nameEn}{" "}
                <span className="muted">
                  ({t.matched}: {m.matchedCount}/{m.totalSymptoms})
                </span>
              </h3>
              {m.note && (
                <div className="warn-box">
                  {lang === "ur" ? t.noCure : m.note}
                </div>
              )}
              <ul className="cites">
                {(lang === "ur" ? m.treatmentUr : m.treatmentEn).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p>
                <strong>
                  {lang === "ur" ? "فعال جزو" : "Active ingredient"}:
                </strong>{" "}
                {m.pesticide.activeIngredient} (WHO {m.pesticide.whoClass}) —{" "}
                {lang === "ur" ? "کٹائی سے پہلے کا وقفہ" : "Pre-harvest interval"}
                : {t.perLabel};{" "}
                {lang === "ur" ? "دوبارہ داخلہ" : "Re-entry"}: {t.perLabel}
              </p>
              <p>
                <strong>{t.organic}:</strong>{" "}
                {lang === "ur" ? m.organicAlternativeUr : m.organicAlternativeEn}
              </p>
              <p className="muted">
                {lang === "ur" ? "ماخذ" : "Source"}: {m.source}
              </p>
            </div>
          ))}
          <p className="muted">
            {lang === "ur"
              ? "ترتیب صرف مماثل علامات کی تعداد سے ہے — کوئی درستگی کا فیصد دعویٰ نہیں کیا جاتا۔"
              : "Ranked by the count of matched symptoms only — no accuracy percentage is claimed."}
          </p>
        </section>

        <section className="card">
          <h2>{t.safetyTitle}</h2>
          {safety ? (
            <>
              <h3>{t.safetyBanned}</h3>
              <p className="muted">
                {lang === "ur" ? safety.bannedCaveatUr : safety.bannedCaveatEn}
              </p>
              <ul className="cites">
                {safety.banned.map((b) => (
                  <li key={b.activeIngredient}>
                    <strong>{b.activeIngredient}</strong> — {b.status}
                  </li>
                ))}
              </ul>
              <h3>{t.safetyPaddy}</h3>
              <p>
                {safety.paddyBanPunjab2025.activeIngredients.join(", ")}
              </p>
              <p className="muted">
                {safety.paddyBanPunjab2025.scope} —{" "}
                {safety.paddyBanPunjab2025.note}
              </p>
              <h3>{t.safetyFake}</h3>
              <ul className="cites">
                {(lang === "ur" ? safety.fakeChecks.ur : safety.fakeChecks.en).map(
                  (s, i) => (
                    <li key={i}>{s}</li>
                  ),
                )}
              </ul>
              <h3>{t.safetyStorage}</h3>
              <ul className="cites">
                {(lang === "ur" ? safety.storage.ur : safety.storage.en).map(
                  (s, i) => (
                    <li key={i}>{s}</li>
                  ),
                )}
                {(lang === "ur" ? safety.disposal.ur : safety.disposal.en).map(
                  (s, i) => (
                    <li key={i}>{s}</li>
                  ),
                )}
              </ul>
              <h3>{t.safetyChild}</h3>
              <ul className="cites">
                {(lang === "ur"
                  ? safety.childAnimalSafety.ur
                  : safety.childAnimalSafety.en
                ).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p className="muted">
                {lang === "ur" ? "ماخذ" : "Source"}: DPP / PARC (2013/2018) —
                WHO 2019 — FAO/CropLife
              </p>
            </>
          ) : (
            <p className="muted">
              {lang === "ur" ? "حفاظتی معلومات لوڈ ہو رہی ہیں…" : "Loading safety guide…"}
            </p>
          )}
        </section>

        <section className="card">
          <h2>{t.fertTitle}</h2>
          <div className="row">
            <div>
              <label htmlFor="fert-crop">{t.crop}</label>
              <select
                id="fert-crop"
                value={fertCrop}
                onChange={(e) => setFertCrop(e.target.value)}
              >
                {CROPS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {lang === "ur" ? c.ur : c.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fert-acres">{t.fertAcres}</label>
              <input
                id="fert-acres"
                type="number"
                min={0.1}
                step={0.5}
                value={fertAcres}
                onChange={(e) => setFertAcres(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label htmlFor="fert-n">
                {lang === "ur" ? "مٹی کی نائٹروجن (اختیاری)" : "Soil N (optional)"}
              </label>
              <input
                id="fert-n"
                type="number"
                value={fertSoilN}
                placeholder="—"
                onChange={(e) => setFertSoilN(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="fert-ph">
                {lang === "ur" ? "مٹی کی pH (اختیاری)" : "Soil pH (optional)"}
              </label>
              <input
                id="fert-ph"
                type="number"
                step={0.1}
                value={fertSoilPh}
                placeholder="—"
                onChange={(e) => setFertSoilPh(e.target.value)}
              />
            </div>
          </div>
          <button className="ask" disabled={fertLoading} onClick={calcFertilizer}>
            {fertLoading ? t.fertWorking : t.fertBtn}
          </button>
          {fertResult && !fertResult.available && (
            <div className="warn-box">
              {lang === "ur" ? fertResult.reasonUr : fertResult.reasonEn}
            </div>
          )}
          {fertResult?.available && (
            <div>
              <table className="data">
                <tbody>
                  <tr>
                    <td>Urea (50 kg {lang === "ur" ? "بوری" : "bags"})</td>
                    <td>{fertResult.ureaBags}</td>
                  </tr>
                  <tr>
                    <td>DAP (50 kg {lang === "ur" ? "بوری" : "bags"})</td>
                    <td>{fertResult.dapBags}</td>
                  </tr>
                  <tr>
                    <td>
                      {lang === "ur" ? "پوٹاش SOP/MOP (50 کلو بوری)" : "Potash SOP/MOP (50 kg bags)"}
                    </td>
                    <td>{fertResult.mopBags}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                <strong>
                  {lang === "ur" ? "بنیاد" : "Basis"}:
                </strong>{" "}
                {lang === "ur"
                  ? "معیاری خوراک"
                  : "standard-dose"}{" "}
                — {fertResult.standardCase}
              </p>
              {fertResult.timing && <p className="muted">{fertResult.timing}</p>}
              <p className="muted">
                {lang === "ur" ? fertResult.soilNoteUr : fertResult.soilNoteEn}
              </p>
              <p className="muted">
                {lang === "ur" ? "ماخذ" : "Source"}: {fertResult.source}
              </p>
            </div>
          )}
        </section>

        <section className="card">
          <h2>{t.sprayTitle}</h2>
          <p className="muted">
            {lang === "ur"
              ? "موزوں گھنٹہ: بارش کا امکان 20٪ سے کم، ہوا 15 کلومیٹر/گھنٹہ سے کم، بارش 0.1 ملی میٹر سے کم۔ ماخذ: Open-Meteo گھنٹہ وار پیش گوئی۔"
              : "Suitable hour: rain chance < 20%, wind < 15 km/h, rain < 0.1 mm. Source: Open-Meteo hourly forecast."}
          </p>
          <button className="ask" disabled={sprayLoading} onClick={loadSpray}>
            {sprayLoading ? t.sprayWorking : t.sprayBtn}
          </button>
          {sprayError && <p className="error">{sprayError}</p>}
          {sprayResult?.hourlyError && (
            <div className="warn-box">{sprayResult.hourlyError}</div>
          )}
          {sprayResult?.hourly && sprayResult.hourly.windows.length === 0 && (
            <div className="warn-box">{t.sprayNone}</div>
          )}
          {sprayResult?.hourly && sprayResult.hourly.windows.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>{lang === "ur" ? "شروع" : "Start"}</th>
                  <th>{lang === "ur" ? "ختم" : "End"}</th>
                  <th>{lang === "ur" ? "گھنٹے" : "Hours"}</th>
                </tr>
              </thead>
              <tbody>
                {sprayResult.hourly.windows.map((w) => (
                  <tr key={w.start}>
                    <td>{w.start.replace("T", " ")}</td>
                    <td>{w.end.replace("T", " ")}</td>
                    <td>{w.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sprayResult?.hourly && (
            <p className="muted">
              {sprayResult.hourly.method} —{" "}
              {sprayResult.hourly.suitableHours}/
              {sprayResult.hourly.hoursChecked}{" "}
              {lang === "ur" ? "گھنٹے موزوں" : "hours suitable"} (Asia/Karachi)
            </p>
          )}
          {sprayResult?.dayGuide && !sprayResult.dayGuide.error && (
            <p>
              {lang === "ur"
                ? sprayResult.dayGuide.reasonUr
                : sprayResult.dayGuide.reasonEn}
            </p>
          )}
          {sprayResult?.dayGuide?.error && (
            <div className="warn-box">{sprayResult.dayGuide.error}</div>
          )}
        </section>

        <section className="card">
          <h2>{t.seasonalTitle}</h2>
          <label htmlFor="season-month">
            {lang === "ur" ? "مہینہ" : "Month"}
          </label>
          <select
            id="season-month"
            value={seasonMonth}
            onChange={(e) => setSeasonMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {lang === "ur"
                  ? ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"][m - 1]
                  : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]}
              </option>
            ))}
          </select>
          {seasonal?.entries.map((e, i) => (
            <div key={i} style={{ marginTop: 10 }}>
              <strong>
                {lang === "ur" ? e.pestOrDisease : e.pestOrDisease}
              </strong>
              <p>{lang === "ur" ? e.watchUr : e.watchEn}</p>
              {e.generalGuidance && (
                <p className="muted">
                  {lang === "ur"
                    ? "عام رہنمائی — معائنے کی یاد دہانی، پیش گوئی نہیں۔"
                    : "General guidance — a reminder to scout, not a forecast."}
                </p>
              )}
            </div>
          ))}
          <p className="muted">
            {lang === "ur"
              ? "ماخذ: پنجاب فصلوں کا کیلنڈر (نومبر 2026)۔"
              : "Source: Punjab cropping calendar (Nov 2026)."}
          </p>
        </section>

        <section className="card">
          <h2>{t.methodsTitle}</h2>
          <ul className="cites">
            <li>
              <strong>
                {lang === "ur" ? "موسم (براہ راست)" : "Weather (live)"}:
              </strong>{" "}
              {lang === "ur"
                ? "Open-Meteo 7 دن کی پیش گوئی، Asia/Karachi۔ پانی کی ضرورت = ET0 − بارش (حوالہ مانگ)۔"
                : "Open-Meteo 7-day forecast, Asia/Karachi. Water need = ET0 − rain (reference demand)."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "مٹی (براہ راست)" : "Soil (live)"}:
              </strong>{" "}
              ISRIC SoilGrids, 0–5 cm. “—”{" "}
              {lang === "ur"
                ? "کا مطلب ہے اس نقطے کے لیے قدر رپورٹ نہیں ہوئی۔"
                : "means no value was reported for this point."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "منڈی (حوالہ)" : "Market (reference)"}:
              </strong>{" "}
              AMIS Punjab, 2–3 Nov 2026 —{" "}
              {lang === "ur"
                ? "براہ راست ریٹ نہیں۔ بیچنے سے پہلے اپنی منڈی سے تصدیق کریں۔"
                : "not a live rate. Confirm at your local mandi before selling."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "پیداوار (بیس لائن ماڈل)" : "Yield (baseline model)"}:
              </strong>{" "}
              {lang === "ur"
                ? "FAO/OWID پاکستان سیریز (1961–2024) پر فٹ شدہ لکیری ٹرینڈ، آخری 25 موسم۔ بیک ٹیسٹ: 2020–2024 الگ رکھ کر جانچا گیا۔ قومی اوسط — ضلعی پیداوار مختلف ہو سکتی ہے۔ کپاس اور گنے کے لیے کوئی سیریز نہیں۔"
                : "Linear trend fitted on the FAO/OWID Pakistan series (1961–2024), last 25 seasons. Backtest: 2020–2024 held out. National average — district yields differ. No series for cotton or sugarcane."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "آمدنی (اندازہ)" : "Revenue (estimate)"}:
              </strong>{" "}
              {lang === "ur"
                ? "پیداوار × حوالہ قیمت۔ اخراجات سے پہلے — یہ منافع نہیں ہے۔"
                : "Forecast yield × reference price. Before costs — this is not profit."}
            </li>
            <li>
              <strong>{lang === "ur" ? "حدود" : "Limits"}:</strong>{" "}
              {lang === "ur"
                ? "اگر کوئی ذریعہ دستیاب نہ ہو تو جواب صاف کہتا ہے — اندازہ نہیں لگاتا۔ ایجنٹ صرف پڑھتا ہے، کچھ بدلتا نہیں۔"
                : "If a source is unavailable, the answer says so — it never guesses. The agent is read-only."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "تصویر سے شناخت (AI مدد)" : "Photo diagnosis (AI-assisted)"}:
              </strong>{" "}
              {lang === "ur"
                ? "Gemini تصویر دیکھ کر بیماری بتاتا ہے — اعتماد صرف کم / درمیانہ / زیادہ، کبھی فیصد نہیں۔ یہ لیب ٹیسٹ نہیں ہے؛ اسپرے سے پہلے زرعی دفتر سے تصدیق کریں۔ بغیر API کی کے یہ بند رہتا ہے اور صاف بتا دیا جاتا ہے۔"
                : "Gemini identifies the disease from a photo — confidence is only low / medium / high, never a percentage. This is NOT a lab test; confirm with the agriculture office before spraying. Without an API key it stays off and says so plainly."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "علامات چیکر" : "Symptom checker"}:
              </strong>{" "}
              {lang === "ur"
                ? "22 تصدیق شدہ بیماریوں کی فہرست (پنجاب محکمہ زراعت / WRI، RRI، CCRI) — ترتیب صرف مماثل علامات کی تعداد سے ہے۔"
                : "22 verified diseases (Punjab Agriculture Department / WRI, RRI, CCRI) — ranked by matched symptom count only."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "زہریلی دوا کی حفاظت" : "Pesticide safety"}:
              </strong>{" "}
              {lang === "ur"
                ? "DPP/PARC ممنوعہ فہرست (2013/2018) — ضلعی زرعی دفتر سے تصدیق کریں۔ WHO درجہ بندی (Ia/Ib سرخ، II پیلا، III نیلا، U سبز)۔ کٹائی سے پہلے کا وقفہ اور دوبارہ داخلہ ہر دوا کے لیے 'لیبل کے مطابق' — کوئی نمبر تصدیق نہیں ہوا۔ وائرس (کپاس/ٹماٹر پتہ مڑنا) کا کوئی کیمیائی علاج نہیں — دوا صرف سفید مکھی کو کنٹرول کرتی ہے۔"
                : "DPP/PARC banned list (2013/2018) — confirm with your district agriculture office. WHO classes (Ia/Ib red, II yellow, III blue, U green). PHI and re-entry are 'per label' for every pesticide — no number was verified. Viruses (cotton/tomato leaf curl) have no chemical cure — the pesticide controls only the whitefly vector."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "کھاد" : "Fertilizer"}:
              </strong>{" "}
              {lang === "ur"
                ? "پنجاب محکمہ زراعت کی خوراکیں (نومبر 2026)؛ بوریاں 50 کلو کی، کل پوری بوریوں میں۔ ٹماٹر کی کوئی تصدیق شدہ خوراک نہیں — ایپ اندازہ نہیں لگاتی۔"
                : "Punjab Agriculture Department doses (Nov 2026); 50 kg bags, totals in whole bags. No verified tomato dose — the app never guesses one."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "اسپرے کا وقت" : "Spray window"}:
              </strong>{" "}
              {lang === "ur"
                ? "Open-Meteo گھنٹہ وار پیش گوئی سے اگلے 48 گھنٹے — موزوں گھنٹہ: بارش کا امکان 20٪ سے کم، ہوا 15 کلومیٹر/گھنٹہ سے کم، بارش 0.1 ملی میٹر سے کم۔"
                : "Next 48 hours from the Open-Meteo hourly forecast — suitable hour: rain chance < 20%, wind < 15 km/h, rain < 0.1 mm."}
            </li>
            <li>
              <strong>
                {lang === "ur" ? "ہائبرڈ AI (نیا)" : "Hybrid AI (new)"}:
              </strong>{" "}
              {lang === "ur"
                ? "جواب آپ کے آلے پر Gemini Nano سے یا کلاؤڈ سے بنتا ہے — ہر جواب پر لکھا ہوتا ہے کہاں بنا۔ بول کر سنانا اور منصوبے کی تصویر کلاؤڈ سے ہے اور اس کے لیے Firebase پروجیکٹ اور کوٹہ چاہیے؛ بغیر اس کے یہ بند رہتا ہے اور پرانا طریقہ چلتا ہے۔"
                : "Answers come from on-device Gemini Nano or the cloud — every answer says where it was made. Spoken answers and plan pictures are cloud-only and need a Firebase project and quota; without them they stay off and the previous method runs."}
            </li>
          </ul>
        </section>

        <footer>
          <h3>{t.aboutTitle}</h3>
          <p>{t.about}</p>
          <p>{t.builtBy}</p>
        </footer>
      </main>
    </div>
  );
}
