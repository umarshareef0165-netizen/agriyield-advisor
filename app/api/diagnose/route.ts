import { NextResponse } from "next/server";
import { diagnosePhoto, DIAGNOSIS_DISCLAIMER_EN, DIAGNOSIS_DISCLAIMER_UR } from "@/lib/diagnose";
import { findDistrict } from "@/lib/districts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const VALID_CROPS = ["wheat", "rice", "maize", "cotton", "sugarcane", "tomato"];

function badRequest(messageEn: string, messageUr: string) {
  return NextResponse.json(
    { available: false, reasonEn: messageEn, reasonUr: messageUr },
    { status: 400 },
  );
}

/**
 * POST /api/diagnose — photo diagnosis (AI-assisted, NOT a lab test).
 * Accepts multipart form-data `file` OR JSON { imageBase64, mimeType, crop, district }.
 * The image is processed in memory only and never stored server-side.
 * Missing key / Gemini failure → HTTP 200 with { available: false, reason }.
 */
export async function POST(req: Request) {
  let imageBase64 = "";
  let mimeType = "";
  let crop = "wheat";
  let districtSlug = "faisalabad";

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      crop = String(form.get("crop") ?? crop);
      districtSlug = String(form.get("district") ?? districtSlug);
      if (!(file instanceof File)) {
        return badRequest(
          "No photo was uploaded — attach a clear photo of the affected plant.",
          "کوئی تصویر اپ لوڈ نہیں ہوئی — متاثرہ پودے کی واضح تصویر لگائیں۔",
        );
      }
      if (!file.type.startsWith("image/")) {
        return badRequest(
          `Only image files are accepted (got ${file.type || "unknown type"}).`,
          "صرف تصویر والی فائلیں قبول ہیں۔",
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return badRequest(
          `Photo is too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — maximum 5 MB.`,
          "تصویر بہت بڑی ہے — زیادہ سے زیادہ 5 MB۔",
        );
      }
      mimeType = file.type;
      imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    } else {
      const body = (await req.json()) as {
        imageBase64?: unknown;
        mimeType?: unknown;
        crop?: unknown;
        district?: unknown;
      };
      crop = String(body.crop ?? crop);
      districtSlug = String(body.district ?? districtSlug);
      if (typeof body.imageBase64 !== "string" || !body.imageBase64) {
        return badRequest(
          "No imageBase64 was provided.",
          "کوئی تصویر نہیں دی گئی۔",
        );
      }
      mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
      if (!mimeType.startsWith("image/")) {
        return badRequest(
          "mimeType must be an image/* type.",
          "mimeType تصویر کی قسم ہونی چاہیے۔",
        );
      }
      imageBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const approxBytes = Math.floor((imageBase64.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return badRequest(
          "Photo is too large — maximum 5 MB.",
          "تصویر بہت بڑی ہے — زیادہ سے زیادہ 5 MB۔",
        );
      }
    }
  } catch {
    return badRequest(
      "The request could not be read — send a photo file or JSON with imageBase64.",
      "درخواست پڑھی نہیں جا سکی — تصویر والی فائل یا JSON بھیجیں۔",
    );
  }

  if (!VALID_CROPS.includes(crop)) {
    return badRequest(
      `Unknown crop "${crop}".`,
      `نامعلوم فصل "${crop}"۔`,
    );
  }
  const district = findDistrict(districtSlug);

  const result = await diagnosePhoto(imageBase64, mimeType, crop, district.nameEn);
  if (!result.available) {
    // Honest unavailable — HTTP 200, never a 500 for a missing key.
    return NextResponse.json({
      available: false,
      reasonEn: result.reasonEn,
      reasonUr: result.reasonUr,
      disclaimerEn: DIAGNOSIS_DISCLAIMER_EN,
      disclaimerUr: DIAGNOSIS_DISCLAIMER_UR,
    });
  }
  return NextResponse.json({
    available: true,
    source: result.source,
    model: result.model,
    crop,
    district: district.slug,
    diagnosis: result.diagnosis,
    disclaimerEn: DIAGNOSIS_DISCLAIMER_EN,
    disclaimerUr: DIAGNOSIS_DISCLAIMER_UR,
    noteEn:
      "AI-assisted identification from a photo only — NOT a lab test.",
    noteUr:
      "صرف تصویر سے AI کی مدد سے شناخت — یہ لیب ٹیسٹ نہیں ہے۔",
  });
}
