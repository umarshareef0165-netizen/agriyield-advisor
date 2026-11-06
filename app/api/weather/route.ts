import { NextResponse } from "next/server";
import { findDistrict } from "@/lib/districts";
import { fetchForecast, irrigationAdvice } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/weather?district=faisalabad — live 7-day Open-Meteo forecast. */
export async function GET(req: Request) {
  const district = findDistrict(
    new URL(req.url).searchParams.get("district") ?? "faisalabad",
  );
  try {
    const forecast = await fetchForecast(district.lat, district.lon);
    return NextResponse.json({
      district,
      forecast,
      irrigation: irrigationAdvice(forecast.days),
    });
  } catch (error) {
    return NextResponse.json(
      {
        district,
        error: (error as Error).message,
        note: "Weather is unavailable right now — the app does not invent weather.",
      },
      { status: 502 },
    );
  }
}
