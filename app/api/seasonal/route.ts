import { NextResponse } from "next/server";
import {
  seasonalWatch,
  currentMonthPk,
  MONTH_NAMES_EN,
  MONTH_NAMES_UR,
} from "@/lib/seasonal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/seasonal?month=11&crop=wheat — this month's watch list. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const monthRaw = params.get("month");
  const month = monthRaw === null ? currentMonthPk() : Number(monthRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "month must be an integer from 1 to 12." },
      { status: 400 },
    );
  }
  const crop = params.get("crop") || undefined;
  return NextResponse.json({
    month,
    monthEn: MONTH_NAMES_EN[month - 1],
    monthUr: MONTH_NAMES_UR[month - 1],
    crop: crop ?? null,
    entries: seasonalWatch(month, crop),
    noteEn:
      "Entries flagged generalGuidance are general extension timing — a reminder to scout, not a forecast.",
    noteUr:
      "عام رہنمائی والی باتیں عمومی مشورہ ہیں — معائنے کی یاد دہانی، پیش گوئی نہیں۔",
    source:
      "Punjab cropping calendar (data/seasonal-watch.json, Nov 2026).",
  });
}
