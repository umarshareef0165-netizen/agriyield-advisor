import { NextResponse } from "next/server";
import { findDistrict } from "@/lib/districts";
import { fetchSprayWindow, sprayWindow } from "@/lib/spray";
import { fetchForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/spray?district=faisalabad — best spraying hours in the next
 * 48h from the live Open-Meteo hourly forecast (rain chance < 20%,
 * wind < 15 km/h, rain < 0.1 mm), plus a day-level guide from the daily
 * forecast. If the hourly fetch fails, the day-level guide is still
 * returned and the failure is stated honestly.
 */
export async function GET(req: Request) {
  const district = findDistrict(
    new URL(req.url).searchParams.get("district") ?? "faisalabad",
  );
  let dayGuide = null;
  try {
    const forecast = await fetchForecast(district.lat, district.lon);
    dayGuide = sprayWindow(forecast.days);
  } catch (error) {
    dayGuide = { error: (error as Error).message };
  }
  try {
    const hourly = await fetchSprayWindow(district.lat, district.lon);
    return NextResponse.json({ district, hourly, dayGuide });
  } catch (error) {
    return NextResponse.json({
      district,
      hourly: null,
      hourlyError: (error as Error).message,
      note: "Hourly spray window is unavailable — the day-level guide below is from the daily forecast only.",
      dayGuide,
    });
  }
}
