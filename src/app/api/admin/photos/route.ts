import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { invalidatePhotosCache } from "@/lib/photos";

const BUCKET = "photos";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sanitizeFileBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").toLowerCase();
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parsePositiveNumber(raw: string, name: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return Math.floor(value);
}

function parseOptionalText(raw: string): string | null {
  const value = raw.trim();
  return value ? value : null;
}

function parseOptionalNumber(raw: string, name: string): number | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return parsed;
}

function parseOptionalBoolean(raw: string, name: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }

  if (["true", "1", "yes", "y"].includes(value)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(value)) {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function parseOptionalDateTime(raw: string, name: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${name} is not a valid datetime`);
  }

  return parsed.toISOString();
}

export async function POST(request: Request) {
  try {
    const adminToken = getRequiredEnv("ADMIN_UPLOAD_TOKEN");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const formData = await request.formData();
    const token = String(formData.get("token") ?? "");
    if (!token || token !== adminToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const caption = String(formData.get("caption") ?? "").trim();
    const tagsRaw = String(formData.get("tags") ?? "");
    const widthRaw = String(formData.get("width") ?? "").trim();
    const heightRaw = String(formData.get("height") ?? "").trim();
    const takenAt = String(formData.get("takenAt") ?? "").trim();
    const exifLastUsedAtRaw = String(formData.get("exifLastUsedAt") ?? "");
    const exifMakeRaw = String(formData.get("exifMake") ?? "");
    const exifModelRaw = String(formData.get("exifModel") ?? "");
    const exifColorSpaceRaw = String(formData.get("exifColorSpace") ?? "");
    const exifColorProfileRaw = String(formData.get("exifColorProfile") ?? "");
    const exifFocalLengthRaw = String(formData.get("exifFocalLengthMm") ?? "");
    const exifAlphaChannelRaw = String(formData.get("exifAlphaChannel") ?? "");
    const exifRedEyeRaw = String(formData.get("exifRedEye") ?? "");
    const exifMeteringModeRaw = String(formData.get("exifMeteringMode") ?? "");
    const exifFNumberRaw = String(formData.get("exifFNumber") ?? "");
    const exifExposureProgramRaw = String(formData.get("exifExposureProgram") ?? "");
    const exifExposureTimeRaw = String(formData.get("exifExposureTime") ?? "");

    if (!slug || !title || !caption || !takenAt) {
      return NextResponse.json(
        { error: "slug, title, caption, takenAt are required" },
        { status: 400 }
      );
    }

    const width = parsePositiveNumber(widthRaw, "width");
    const height = parsePositiveNumber(heightRaw, "height");
    const tags = parseTags(tagsRaw);
    const exifLastUsedAt = parseOptionalDateTime(exifLastUsedAtRaw, "exifLastUsedAt");
    const exifMake = parseOptionalText(exifMakeRaw);
    const exifModel = parseOptionalText(exifModelRaw);
    const exifColorSpace = parseOptionalText(exifColorSpaceRaw);
    const exifColorProfile = parseOptionalText(exifColorProfileRaw);
    const exifFocalLengthMm = parseOptionalNumber(exifFocalLengthRaw, "exifFocalLengthMm");
    const exifAlphaChannel = parseOptionalBoolean(exifAlphaChannelRaw, "exifAlphaChannel");
    const exifRedEye = parseOptionalBoolean(exifRedEyeRaw, "exifRedEye");
    const exifMeteringMode = parseOptionalText(exifMeteringModeRaw);
    const exifFNumber = parseOptionalNumber(exifFNumberRaw, "exifFNumber");
    const exifExposureProgram = parseOptionalText(exifExposureProgramRaw);
    const exifExposureTime = parseOptionalText(exifExposureTimeRaw);

    const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "jpg" : "jpg";
    const normalizedExtension = extension.toLowerCase();
    const fileName = `${sanitizeFileBaseName(slug)}-${Date.now()}.${normalizedExtension}`;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, { upsert: false, contentType });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const src = publicUrlData.publicUrl;

    const nowIso = new Date().toISOString();
    const id = `p_${crypto.randomUUID().slice(0, 8)}`;

    const { error: insertError } = await supabase.from("photos").insert({
      id,
      slug,
      src,
      storage_path: fileName,
      width,
      height,
      title,
      caption,
      tags,
      taken_at: takenAt,
      created_at: nowIso,
      exif_last_used_at: exifLastUsedAt,
      exif_make: exifMake,
      exif_model: exifModel,
      exif_color_space: exifColorSpace,
      exif_color_profile: exifColorProfile,
      exif_focal_length_mm: exifFocalLengthMm,
      exif_alpha_channel: exifAlphaChannel,
      exif_red_eye: exifRedEye,
      exif_metering_mode: exifMeteringMode,
      exif_f_number: exifFNumber,
      exif_exposure_program: exifExposureProgram,
      exif_exposure_time: exifExposureTime,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    invalidatePhotosCache();
    return NextResponse.json({ ok: true, id, slug, src });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
