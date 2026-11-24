/**
 * Deterministic symptom checker over the verified disease dataset
 * (data/diseases.json — 22 diseases, Punjab Agriculture Department /
 * WRI, RRI, CCRI guidance; WHO 2019 pesticide classes).
 *
 * Pure functions, no network, no LLM. A symptom is identified by
 * `${diseaseId}#${index}` where index is the position in that disease's
 * symptomsEn/symptomsUr list. Matching is a plain count of matched
 * symptoms — no invented accuracy or probability is ever produced.
 */
import diseasesData from "../data/diseases.json";

export interface DiseasePesticide {
  activeIngredient: string;
  whoClass: string;
  phiDays: number | null;
  reentryHours: number | null;
  ppeEn: string[];
  ppeUr: string[];
  firstAidEn: string;
  firstAidUr: string;
}

export interface Disease {
  id: string;
  crop: string;
  nameEn: string;
  nameUr: string;
  symptomsEn: string[];
  symptomsUr: string[];
  treatmentEn: string[];
  treatmentUr: string[];
  pesticide: DiseasePesticide;
  organicAlternativeEn: string;
  organicAlternativeUr: string;
  source: string;
  urUnverified: boolean;
  note?: string;
}

export interface SymptomOption {
  id: string;
  diseaseId: string;
  textEn: string;
  textUr: string;
}

export interface SymptomMatch {
  disease: Disease;
  /** Number of the farmer's selected symptoms that belong to this disease. */
  matchedCount: number;
  totalSymptoms: number;
  matchedSymptomsEn: string[];
  matchedSymptomsUr: string[];
}

const DISEASES: Disease[] = (diseasesData as { diseases: Disease[] }).diseases;

export function getAllDiseases(): Disease[] {
  return DISEASES;
}

export function getDiseaseById(id: string): Disease | null {
  return DISEASES.find((d) => d.id === id) ?? null;
}

export function getDiseasesForCrop(crop: string): Disease[] {
  return DISEASES.filter((d) => d.crop === crop);
}

/** Every checkable symptom for a crop, one checkbox per symptom. */
export function listSymptoms(crop: string): SymptomOption[] {
  const out: SymptomOption[] = [];
  for (const d of getDiseasesForCrop(crop)) {
    d.symptomsEn.forEach((textEn, i) => {
      out.push({
        id: `${d.id}#${i}`,
        diseaseId: d.id,
        textEn,
        textUr: d.symptomsUr[i] ?? "",
      });
    });
  }
  return out;
}

/**
 * Rank diseases for a crop by how many of the selected symptom ids match.
 * Ties break by fewer total symptoms (more specific match first), then by
 * disease id for determinism. Unknown symptom ids are ignored. A disease
 * with zero matches is never returned.
 */
export function matchSymptoms(crop: string, symptomIds: string[]): SymptomMatch[] {
  const selected = new Set(symptomIds);
  const matches: SymptomMatch[] = [];
  for (const d of getDiseasesForCrop(crop)) {
    const matchedIdx: number[] = [];
    d.symptomsEn.forEach((_s, i) => {
      if (selected.has(`${d.id}#${i}`)) matchedIdx.push(i);
    });
    if (matchedIdx.length === 0) continue;
    matches.push({
      disease: d,
      matchedCount: matchedIdx.length,
      totalSymptoms: d.symptomsEn.length,
      matchedSymptomsEn: matchedIdx.map((i) => d.symptomsEn[i]),
      matchedSymptomsUr: matchedIdx.map((i) => d.symptomsUr[i] ?? ""),
    });
  }
  matches.sort(
    (a, b) =>
      b.matchedCount - a.matchedCount ||
      a.totalSymptoms - b.totalSymptoms ||
      a.disease.id.localeCompare(b.disease.id),
  );
  return matches;
}
