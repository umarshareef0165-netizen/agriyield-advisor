import { NextResponse } from "next/server";
import { listSymptoms, matchSymptoms, getDiseasesForCrop } from "@/lib/symptoms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/symptoms?crop=wheat — the checkable symptoms for a crop.
 * GET /api/symptoms?crop=wheat&symptoms=wheat-yellow-rust#0,wheat-yellow-rust#1
 *   — ranked disease matches (count of matched symptoms, no percentages).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const crop = params.get("crop") ?? "wheat";
  const diseases = getDiseasesForCrop(crop);
  if (diseases.length === 0) {
    return NextResponse.json(
      {
        error: `No disease data for crop "${crop}". Crops with data: wheat, rice, maize, cotton, sugarcane, tomato.`,
      },
      { status: 400 },
    );
  }
  const symptomsParam = params.get("symptoms");
  if (!symptomsParam) {
    return NextResponse.json({
      crop,
      symptoms: listSymptoms(crop),
      source: "Verified disease dataset (data/diseases.json) — Punjab Agriculture Department / WRI, RRI, CCRI guidance; WHO 2019 pesticide classes.",
    });
  }
  const symptomIds = symptomsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const matches = matchSymptoms(crop, symptomIds).map((m) => ({
    diseaseId: m.disease.id,
    nameEn: m.disease.nameEn,
    nameUr: m.disease.nameUr,
    matchedCount: m.matchedCount,
    totalSymptoms: m.totalSymptoms,
    matchedSymptomsEn: m.matchedSymptomsEn,
    matchedSymptomsUr: m.matchedSymptomsUr,
    treatmentEn: m.disease.treatmentEn,
    treatmentUr: m.disease.treatmentUr,
    organicAlternativeEn: m.disease.organicAlternativeEn,
    organicAlternativeUr: m.disease.organicAlternativeUr,
    pesticide: {
      activeIngredient: m.disease.pesticide.activeIngredient,
      whoClass: m.disease.pesticide.whoClass,
      // PHI / re-entry are null for every disease — show "label ke mutabiq".
      phiDays: null,
      reentryHours: null,
      ppeEn: m.disease.pesticide.ppeEn,
      ppeUr: m.disease.pesticide.ppeUr,
      firstAidEn: m.disease.pesticide.firstAidEn,
      firstAidUr: m.disease.pesticide.firstAidUr,
    },
    note: m.disease.note ?? null,
    source: m.disease.source,
  }));
  return NextResponse.json({
    crop,
    selectedSymptoms: symptomIds,
    matches,
    method:
      "Ranked by the count of matched symptoms only — no accuracy or probability is claimed.",
    source: "Verified disease dataset (data/diseases.json).",
  });
}
