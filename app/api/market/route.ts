import { NextResponse } from "next/server";
import { getMarket, MARKET_CROPS, type MarketCrop } from "@/lib/market";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/market?crop=wheat&district=faisalabad — REFERENCE mandi prices.
 * Curated dataset (AMIS Punjab, 2–3 Nov 2026). Labelled reference, never live.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const crop = (params.get("crop") ?? "wheat") as MarketCrop;
  if (!MARKET_CROPS.includes(crop)) {
    return NextResponse.json(
      { error: `Unknown crop "${crop}". Supported: ${MARKET_CROPS.join(", ")}.` },
      { status: 400 },
    );
  }
  const district = params.get("district");
  return NextResponse.json(getMarket(crop, district));
}
