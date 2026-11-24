import { NextResponse } from "next/server";
import { recommendFertilizer } from "@/lib/fertilizer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/fertilizer?crop=wheat&acres=5&soilN=&soilPh= — bags needed. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const crop = params.get("crop") ?? "wheat";
  const acres = Number(params.get("acres") ?? "1");
  if (!Number.isFinite(acres) || acres <= 0 || acres > 10000) {
    return NextResponse.json(
      { error: "acres must be a number greater than 0." },
      { status: 400 },
    );
  }
  const soilNRaw = params.get("soilN");
  const soilPhRaw = params.get("soilPh");
  const soilN = soilNRaw !== null && soilNRaw !== "" ? Number(soilNRaw) : undefined;
  const soilPh = soilPhRaw !== null && soilPhRaw !== "" ? Number(soilPhRaw) : undefined;
  if ((soilN !== undefined && !Number.isFinite(soilN)) || (soilPh !== undefined && !Number.isFinite(soilPh))) {
    return NextResponse.json(
      { error: "soilN and soilPh must be numbers when given." },
      { status: 400 },
    );
  }
  const result = recommendFertilizer(crop, acres, soilN, soilPh);
  return NextResponse.json({
    ...result,
    bagWeightKg: 50,
    noteEn:
      "Bags are 50 kg. Totals are whole bags (rounded up). Wheat bags are quoted from the Punjab Agriculture Department Nov 2026 advisory; other crops are calculated from the department's N-P-K ranges.",
    noteUr:
      "بوریاں 50 کلو کی ہیں۔ کل پوری بوریوں میں ہے۔ گندم کی بوریاں پنجاب محکمہ زراعت کے نومبر 2026 مشورے سے ہیں؛ دیگر فصلوں کی محکمہ کی N-P-K حد سے حساب کی گئی ہیں۔",
  });
}
