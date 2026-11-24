/**
 * Pesticide safety accessors over the verified dataset
 * (data/pesticide-safety.json — DPP/PARC banned list, FAO/CropLife fake
 * checks, WHO 2019 hazard classes).
 *
 * WHO colour bands (WHO Recommended Classification of Pesticides by
 * Hazard, 2019): Ia extremely hazardous — red; Ib highly hazardous —
 * red; II moderately hazardous — yellow; III slightly hazardous — blue;
 * U unlikely to present acute hazard — green.
 *
 * Honesty: PHI and re-entry are null for every disease in the dataset —
 * no product-specific value could be verified. The safety block therefore
 * always says "label ke mutabiq" (per label) and never shows a number.
 */
import safetyData from "../data/pesticide-safety.json";
import { getDiseaseById, type Disease } from "./symptoms";

export interface BannedEntry {
  activeIngredient: string;
  source: string;
  status: string;
}

export interface WhoBand {
  /** WHO class as recorded in the dataset (Ia, Ib, II, III, U). */
  class: string;
  /** Plain-language hazard wording. */
  labelEn: string;
  labelUr: string;
  /** WHO colour band. */
  colour: "red" | "yellow" | "blue" | "green";
}

export const WHO_BANDS: Record<string, Omit<WhoBand, "class">> = {
  Ia: {
    labelEn: "Extremely hazardous",
    labelUr: "انتہائی خطرناک",
    colour: "red",
  },
  Ib: {
    labelEn: "Highly hazardous",
    labelUr: "بہت خطرناک",
    colour: "red",
  },
  II: {
    labelEn: "Moderately hazardous",
    labelUr: "درمیانے درجے کا خطرناک",
    colour: "yellow",
  },
  III: {
    labelEn: "Slightly hazardous",
    labelUr: "معمولی خطرناک",
    colour: "blue",
  },
  U: {
    labelEn: "Unlikely to present acute hazard",
    labelUr: "شدید خطرہ پیش کرنے کا امکان نہیں",
    colour: "green",
  },
};

export function whoBandFor(whoClass: string): WhoBand {
  const band = WHO_BANDS[whoClass];
  if (!band) {
    return {
      class: whoClass,
      labelEn: "Hazard class not verified — check the product label",
      labelUr: "خطرے کی درجہ بندی کی تصدیق نہیں — پراڈکٹ لیبل دیکھیں",
      colour: "yellow",
    };
  }
  return { class: whoClass, ...band };
}

export interface SafetyBlock {
  diseaseId: string;
  diseaseEn: string;
  diseaseUr: string;
  activeIngredient: string;
  whoClass: string;
  band: WhoBand;
  /** Always null in the verified dataset — shown as "label ke mutabiq". */
  phiDays: null;
  /** Always null in the verified dataset — shown as "label ke mutabiq". */
  reentryHours: null;
  ppeEn: string[];
  ppeUr: string[];
  firstAidEn: string;
  firstAidUr: string;
  /** Set for virus/bacterial entries where no chemical cure exists. */
  noCureNote?: string;
}

const data = safetyData as {
  banned: BannedEntry[];
  paddyBanPunjab2025: {
    activeIngredients: string[];
    note: string;
    scope: string;
    source: string;
  };
  fakeChecksEn: string[];
  fakeChecksUr: string[];
  storageEn: string[];
  storageUr: string[];
  disposalEn: string[];
  disposalUr: string[];
  childAnimalSafetyEn: string[];
  childAnimalSafetyUr: string[];
  note: string;
};

/** National banned list — present with the confirmation caveat, always. */
export function getBannedList(): {
  banned: BannedEntry[];
  caveatEn: string;
  caveatUr: string;
} {
  return {
    banned: data.banned,
    caveatEn:
      "Banned per the DPP/PARC lists available to us (2013/2018) — confirm with your district agriculture office.",
    caveatUr:
      "ہمارے پاس دستیاب DPP/PARC فہرستوں (2013/2018) کے مطابق ممنوع — اپنے ضلعی زرعی دفتر سے تصدیق کریں۔",
  };
}

export function getPaddyBan(): {
  activeIngredients: string[];
  note: string;
  scope: string;
  source: string;
} {
  return data.paddyBanPunjab2025;
}

export function getFakeChecks(): { en: string[]; ur: string[] } {
  return { en: data.fakeChecksEn, ur: data.fakeChecksUr };
}

export function getStorageGuide(): { en: string[]; ur: string[] } {
  return { en: data.storageEn, ur: data.storageUr };
}

export function getDisposalGuide(): { en: string[]; ur: string[] } {
  return { en: data.disposalEn, ur: data.disposalUr };
}

export function getChildAnimalSafety(): { en: string[]; ur: string[] } {
  return { en: data.childAnimalSafetyEn, ur: data.childAnimalSafetyUr };
}

/**
 * The full pesticide safety block for one disease (by disease id), with
 * its WHO class + colour band. PHI / re-entry are null by design — the
 * caller must render "label ke mutabiq", never a number.
 */
export function safetyBlockFor(diseaseId: string): SafetyBlock | null {
  const d: Disease | null = getDiseaseById(diseaseId);
  if (!d) return null;
  return {
    diseaseId: d.id,
    diseaseEn: d.nameEn,
    diseaseUr: d.nameUr,
    activeIngredient: d.pesticide.activeIngredient,
    whoClass: d.pesticide.whoClass,
    band: whoBandFor(d.pesticide.whoClass),
    phiDays: null,
    reentryHours: null,
    ppeEn: d.pesticide.ppeEn,
    ppeUr: d.pesticide.ppeUr,
    firstAidEn: d.pesticide.firstAidEn,
    firstAidUr: d.pesticide.firstAidUr,
    noCureNote: d.note,
  };
}
