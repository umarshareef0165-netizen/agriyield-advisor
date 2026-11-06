import { NextResponse } from "next/server";
import { findDistrict } from "@/lib/districts";
import { fetchSoil, buildSoilUrl } from "@/lib/soil";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/soil?district=faisalabad — live ISRIC SoilGrids properties. */
export async function GET(req: Request) {
  const district = findDistrict(
    new URL(req.url).searchParams.get("district") ?? "faisalabad",
  );
  try {
    const soil = await fetchSoil(district.lat, district.lon);
    return NextResponse.json({ district, soil });
  } catch (error) {
    return NextResponse.json(
      {
        district,
        error: (error as Error).message,
        sourceUrl: buildSoilUrl(district.lat, district.lon),
        note: "Soil data is unavailable right now — the app does not invent soil.",
      },
      { status: 502 },
    );
  }
}
