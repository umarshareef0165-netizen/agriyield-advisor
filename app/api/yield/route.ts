import { NextResponse } from "next/server";
import { forecastYield, YIELD_CROPS, type YieldCrop } from "@/lib/yield";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/yield?crop=wheat — trend-baseline yield forecast.
 * Linear trend fitted on the FAO/OWID Pakistan yield series (1961–2024).
 * National average only; no district adjustment. RMSE reported as measured.
 */
export async function GET(req: Request) {
  const crop = (new URL(req.url).searchParams.get("crop") ?? "wheat") as YieldCrop;
  if (!YIELD_CROPS.includes(crop)) {
    return NextResponse.json(
      {
        error: `No yield model for "${crop}". The model covers ${YIELD_CROPS.join(", ")} only (FAO/OWID series).`,
      },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(forecastYield(crop));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
