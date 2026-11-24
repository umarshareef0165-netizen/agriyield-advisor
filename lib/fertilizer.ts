/**
 * Fertiliser recommendations from the Punjab Agriculture Department doses
 * (data/fertilizer-doses.json, Nov 2026).
 *
 * Bag convention (verified in the research file): bags are 50 kg.
 * Urea is 46% N; DAP is 18-46-0; SOP is 50% K2O; MOP is 60% K2O.
 * Wheat bags are quoted directly from the department's Nov 2026 advisory;
 * other crops use the department's N-P-K ranges converted to kg/acre with
 * bags calculated arithmetically (flagged bagsCalculated in the data).
 *
 * Totals are whole bags: ceil(bags per acre × acres) — a farmer cannot
 * buy a fraction of a sealed bag.
 *
 * Honesty: there is NO verified soil-test adjustment rule in the research
 * (the wheat variants are by soil-fertility class, and no mapping from a
 * soil N/pH reading to a class was verified), so soil readings are
 * recorded but the standard dose is used and labelled standard-dose.
 * Tomato has NO verified Punjab dose — it is always unavailable.
 */
import dosesData from "../data/fertilizer-doses.json";

export interface FertilizerDose {
  crop: string;
  nP2O5K2OkgPerAcre: { N: number; P2O5: number; K2O: number } | null;
  bagsPerAcre: { urea: number; dap: number; sopOrMop: number } | null;
  bagsCalculated: boolean | null;
  standardCase: string | null;
  timing: string | null;
  source: string | null;
  micronutrients?: string;
  crossCheck?: string;
  unverified?: boolean;
  note?: string;
}

const CROPS: FertilizerDose[] = (dosesData as { crops: FertilizerDose[] }).crops;

export const BAG_WEIGHT_KG = 50;

export type FertilizerResult =
  | {
      available: true;
      crop: string;
      acres: number;
      ureaBags: number;
      dapBags: number;
      mopBags: number;
      /** kg of each product per acre (bags × 50 kg). */
      ureaKgPerAcre: number;
      dapKgPerAcre: number;
      mopKgPerAcre: number;
      basis: string;
      standardCase: string;
      timing: string | null;
      source: string;
      bagsCalculated: boolean;
      micronutrients?: string;
      crossCheck?: string;
      /** No verified soil adjustment exists — always false, stated plainly. */
      soilUsed: false;
      soilNoteEn: string;
      soilNoteUr: string;
    }
  | {
      available: false;
      crop: string;
      acres: number;
      reasonEn: string;
      reasonUr: string;
      soilUsed: false;
    };

export function getFertilizerDose(crop: string): FertilizerDose | null {
  return CROPS.find((c) => c.crop === crop) ?? null;
}

export function recommendFertilizer(
  crop: string,
  acres: number,
  soilN?: number,
  soilPh?: number,
): FertilizerResult {
  const dose = getFertilizerDose(crop);
  const soilNoteEn =
    soilN !== undefined || soilPh !== undefined
      ? "Soil readings were given, but no verified rule maps a soil N/pH reading to a different dose, so the standard dose is used — get a soil test interpreted by the district agriculture office for a field-specific dose."
      : "No soil test given — standard dose for the stated case. A soil test can change the dose; ask the district agriculture office.";
  const soilNoteUr =
    soilN !== undefined || soilPh !== undefined
      ? "مٹی کی قدریں دی گئی تھیں، لیکن مٹی کی N/pH قدر سے خوراک بدلنے کا کوئی تصدیق شدہ اصول نہیں ہے، اس لیے معیاری خوراک استعمال کی گئی ہے — کھیت کے مطابق خوراک کے لیے ضلعی زرعی دفتر سے مٹی کا ٹیسٹ کروائیں۔"
      : "مٹی کا ٹیسٹ نہیں دیا گیا — بیان شدہ صورت کی معیاری خوراک۔ مٹی کا ٹیسٹ خوراک بدل سکتا ہے؛ ضلعی زرعی دفتر سے پوچھیں۔";

  if (!dose || !dose.bagsPerAcre || dose.unverified) {
    return {
      available: false,
      crop,
      acres,
      reasonEn:
        "No verified Punjab Agriculture Department fertiliser dose exists for tomato — the app will not guess one. Use a soil test and the district agriculture office's advice.",
      reasonUr:
        "ٹماٹر کے لیے پنجاب محکمہ زراعت کی کوئی تصدیق شدہ کھاد کی خوراک موجود نہیں — ایپ اندازہ نہیں لگائے گی۔ مٹی کا ٹیسٹ کروائیں اور ضلعی زرعی دفتر کے مشورے پر عمل کریں۔",
      soilUsed: false,
    };
  }

  const perAcre = dose.bagsPerAcre;
  return {
    available: true,
    crop,
    acres,
    ureaBags: Math.ceil(perAcre.urea * acres),
    dapBags: Math.ceil(perAcre.dap * acres),
    mopBags: Math.ceil(perAcre.sopOrMop * acres),
    ureaKgPerAcre: perAcre.urea * BAG_WEIGHT_KG,
    dapKgPerAcre: perAcre.dap * BAG_WEIGHT_KG,
    mopKgPerAcre: perAcre.sopOrMop * BAG_WEIGHT_KG,
    basis: "standard-dose",
    standardCase: dose.standardCase ?? "Standard Punjab recommendation",
    timing: dose.timing,
    source: dose.source ?? "Punjab Agriculture Department",
    bagsCalculated: dose.bagsCalculated === true,
    micronutrients: dose.micronutrients,
    crossCheck: dose.crossCheck,
    soilUsed: false,
    soilNoteEn,
    soilNoteUr,
  };
}
