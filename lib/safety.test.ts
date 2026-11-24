import { describe, it, expect } from "vitest";
import {
  getBannedList,
  getPaddyBan,
  getFakeChecks,
  getStorageGuide,
  getDisposalGuide,
  getChildAnimalSafety,
  safetyBlockFor,
  whoBandFor,
} from "./safety";

describe("WHO colour bands", () => {
  it("maps Ia/Ib to red, II to yellow, III to blue, U to green", () => {
    expect(whoBandFor("Ia").colour).toBe("red");
    expect(whoBandFor("Ib").colour).toBe("red");
    expect(whoBandFor("II").colour).toBe("yellow");
    expect(whoBandFor("III").colour).toBe("blue");
    expect(whoBandFor("U").colour).toBe("green");
  });
});

describe("getBannedList", () => {
  it("lists the DPP/PARC banned actives with the confirmation caveat", () => {
    const { banned, caveatEn, caveatUr } = getBannedList();
    expect(banned.length).toBeGreaterThanOrEqual(12);
    expect(banned.map((b) => b.activeIngredient)).toContain("DDT");
    expect(banned.map((b) => b.activeIngredient)).toContain("Monocrotophos");
    expect(caveatEn).toMatch(/confirm with your district agriculture office/i);
    expect(caveatUr).toBeTruthy();
  });
});

describe("getPaddyBan", () => {
  it("keeps the Punjab paddy ban separate and paddy-only (12 named of 13)", () => {
    const ban = getPaddyBan();
    expect(ban.activeIngredients).toHaveLength(12);
    expect(ban.scope).toMatch(/Paddy.*Punjab only/i);
    expect(ban.note).toMatch(/13th.*not verified|13th name could not be verified/i);
  });
});

describe("safety guides", () => {
  it("fake checks, storage, disposal and child/animal safety all have En + Ur", () => {
    expect(getFakeChecks().en.length).toBeGreaterThan(0);
    expect(getFakeChecks().en.length).toBe(getFakeChecks().ur.length);
    expect(getStorageGuide().en.length).toBeGreaterThan(0);
    expect(getDisposalGuide().en.length).toBeGreaterThan(0);
    expect(getChildAnimalSafety().en.length).toBeGreaterThan(0);
    expect(getChildAnimalSafety().en.length).toBe(
      getChildAnimalSafety().ur.length,
    );
  });
});

describe("safetyBlockFor", () => {
  it("returns the WHO class + colour band with null PHI/re-entry", () => {
    const block = safetyBlockFor("wheat-yellow-rust");
    expect(block).not.toBeNull();
    expect(block?.activeIngredient).toBe("Propiconazole");
    expect(block?.whoClass).toBe("II");
    expect(block?.band.colour).toBe("yellow");
    expect(block?.phiDays).toBeNull();
    expect(block?.reentryHours).toBeNull();
    expect(block?.ppeEn.length).toBeGreaterThan(0);
    expect(block?.firstAidEn).toBeTruthy();
  });

  it("carries the no-cure note for the cotton leaf curl virus", () => {
    const block = safetyBlockFor("cotton-leaf-curl-virus");
    expect(block?.noCureNote).toMatch(/no chemical cure/i);
    expect(block?.activeIngredient).toMatch(/whitefly vector only/i);
  });

  it("returns null for an unknown disease", () => {
    expect(safetyBlockFor("made-up-disease")).toBeNull();
  });
});
