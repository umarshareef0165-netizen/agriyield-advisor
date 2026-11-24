import { describe, it, expect } from "vitest";
import {
  listSymptoms,
  matchSymptoms,
  getAllDiseases,
  getDiseaseById,
} from "./symptoms";

describe("disease dataset", () => {
  it("has 22 verified diseases", () => {
    expect(getAllDiseases()).toHaveLength(22);
  });

  it("has null PHI and re-entry for every disease", () => {
    for (const d of getAllDiseases()) {
      expect(d.pesticide.phiDays).toBeNull();
      expect(d.pesticide.reentryHours).toBeNull();
    }
  });

  it("flags the virus entries with a no-cure note", () => {
    const clcv = getDiseaseById("cotton-leaf-curl-virus");
    expect(clcv?.note).toMatch(/no chemical cure/i);
    const tomato = getDiseaseById("tomato-leaf-curl");
    expect(tomato?.note).toMatch(/no chemical cure/i);
  });
});

describe("listSymptoms", () => {
  it("lists 3 symptoms per wheat disease (5 wheat diseases)", () => {
    expect(listSymptoms("wheat")).toHaveLength(15);
  });

  it("returns nothing for an unknown crop", () => {
    expect(listSymptoms("potato")).toHaveLength(0);
  });
});

describe("matchSymptoms", () => {
  it("ranks by matched symptom count", () => {
    const matches = matchSymptoms("wheat", [
      "wheat-yellow-rust#0",
      "wheat-yellow-rust#1",
      "wheat-brown-rust#0",
    ]);
    expect(matches[0].disease.id).toBe("wheat-yellow-rust");
    expect(matches[0].matchedCount).toBe(2);
    expect(matches[1].disease.id).toBe("wheat-brown-rust");
    expect(matches[1].matchedCount).toBe(1);
  });

  it("returns no match when nothing matches", () => {
    expect(matchSymptoms("wheat", ["rice-blast#0"])).toHaveLength(0);
    expect(matchSymptoms("wheat", [])).toHaveLength(0);
  });

  it("ignores unknown symptom ids", () => {
    const matches = matchSymptoms("wheat", [
      "wheat-yellow-rust#0",
      "made-up#9",
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedCount).toBe(1);
  });

  it("carries treatment and the pesticide safety block with each match", () => {
    const matches = matchSymptoms("cotton", ["cotton-whitefly#0"]);
    expect(matches[0].disease.treatmentEn.length).toBeGreaterThan(0);
    expect(matches[0].disease.pesticide.activeIngredient).toBe("Pyriproxyfen");
    expect(matches[0].disease.pesticide.whoClass).toBe("U");
    expect(matches[0].disease.pesticide.phiDays).toBeNull();
  });
});
