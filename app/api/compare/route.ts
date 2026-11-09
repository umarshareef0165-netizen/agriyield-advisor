import { NextResponse } from "next/server";
import { findDistrict } from "@/lib/districts";
import { compareCrops } from "@/lib/compare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/compare?district=faisalabad — wheat, rice and maize side by
 * side: trend-baseline forecast, backtest MAE, dated reference price and
 * gross revenue/ha estimate (before costs). Same numbers as the
 * single-crop views, placed next to each other for a sowing choice.
 */
export async function GET(req: Request) {
  const district = findDistrict(
    new URL(req.url).searchParams.get("district") ?? "faisalabad",
  );
  try {
    return NextResponse.json({ district, ...compareCrops(district.slug) });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
