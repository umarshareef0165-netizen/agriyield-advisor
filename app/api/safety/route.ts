import { NextResponse } from "next/server";
import {
  getBannedList,
  getPaddyBan,
  getFakeChecks,
  getStorageGuide,
  getDisposalGuide,
  getChildAnimalSafety,
  safetyBlockFor,
} from "@/lib/safety";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/safety — banned list + fake checks + storage/disposal +
 * child/animal safety guides.
 * GET /api/safety?disease=wheat-yellow-rust — one disease's safety block.
 */
export async function GET(req: Request) {
  const disease = new URL(req.url).searchParams.get("disease");
  if (disease) {
    const block = safetyBlockFor(disease);
    if (!block) {
      return NextResponse.json(
        { error: `No safety data for disease "${disease}".` },
        { status: 400 },
      );
    }
    return NextResponse.json({ safetyBlock: block });
  }
  const banned = getBannedList();
  return NextResponse.json({
    banned: banned.banned,
    bannedCaveatEn: banned.caveatEn,
    bannedCaveatUr: banned.caveatUr,
    paddyBanPunjab2025: getPaddyBan(),
    fakeChecks: getFakeChecks(),
    storage: getStorageGuide(),
    disposal: getDisposalGuide(),
    childAnimalSafety: getChildAnimalSafety(),
    source:
      "Department of Plant Protection / PARC banned list (2013/2018); FAO/CropLife counterfeit guidance; WHO 2019 hazard classes (data/pesticide-safety.json).",
  });
}
