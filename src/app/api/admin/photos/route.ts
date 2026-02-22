import { NextResponse } from "next/server";
import { ensureMinimumResolution, WEBP_QUALITY_UPLOAD } from "@/lib/image-resolution";
import { invalidatePhotosCache } from "@/lib/photos";
import { authorizeAdminRequest, createServiceRoleClient } from "@/lib/admin-auth-server";

const BUCKET = "photos";
const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/tiff",
]);

function getMaxUploadSizeBytes(): number {
  const value = process.env.ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES;
  if (!value) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }

  return Math.floor(parsed);
}

function sanitizeFileBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").toLowerCase();
}

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function parseOptionalDate(raw: string, name: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === "none") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${name} is not a valid date`);
  }

  return parsed.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authResult = await authorizeAdminRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, slug, src, width, height, title, caption, tags, taken_at, created_at, exif_make, exif_model, exif_lens_model, exif_iso, exif_focal_length_mm, exif_f_number, exif_exposure_time"
    )
    .order("created_at", { ascending: false })
    .order("slug", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      src: row.src,
      width: row.width,
      height: row.height,
      title: row.title,
      caption: row.caption,
      tags: row.tags,
      takenAt: row.taken_at,
      createdAt: row.created_at,
      exifMake: row.exif_make,
      exifModel: row.exif_model,
      exifLensModel: row.exif_lens_model,
      exifIso: row.exif_iso,
      exifFocalLengthMm: row.exif_focal_length_mm,
      exifFNumber: row.exif_f_number,
      exifExposureTime: row.exif_exposure_time,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const maxUploadSizeBytes = getMaxUploadSizeBytes();
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > maxUploadSizeBytes + 1024 * 1024) {
        return NextResponse.json(
          { error: `file is too large (max ${maxUploadSizeBytes} bytes)` },
          { status: 413 }
        );
      }
    }

    const formData = await request.formData();

    const authResult = await authorizeAdminRequest(request, {
      formData,
      allowLegacyToken: true,
    });
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > maxUploadSizeBytes) {
      return NextResponse.json(
        { error: `file is too large (max ${maxUploadSizeBytes} bytes)` },
        { status: 413 }
      );
    }

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
    }

    const slugRaw = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const caption = String(formData.get("caption") ?? "").trim();
    const tagsRaw = String(formData.get("tags") ?? "");
    const widthRaw = String(formData.get("width") ?? "").trim();
    const heightRaw = String(formData.get("height") ?? "").trim();
    const takenAtRaw = String(formData.get("takenAt") ?? "").trim();
    const exifLastUsedAtRaw = String(formData.get("exifLastUsedAt") ?? "");
    const exifMakeRaw = String(formData.get("exifMake") ?? "");
    const exifModelRaw = String(formData.get("exifModel") ?? "");
    const exifLensModelRaw = String(formData.get("exifLensModel") ?? "");
    const exifIsoRaw = String(formData.get("exifIso") ?? "");
    const exifColorSpaceRaw = String(formData.get("exifColorSpace") ?? "");
    const exifColorProfileRaw = String(formData.get("exifColorProfile") ?? "");
    const exifFocalLengthRaw = String(formData.get("exifFocalLengthMm") ?? "");
    const exifAlphaChannelRaw = String(formData.get("exifAlphaChannel") ?? "");
    const exifRedEyeRaw = String(formData.get("exifRedEye") ?? "");
    const exifMeteringModeRaw = String(formData.get("exifMeteringMode") ?? "");
    const exifFNumberRaw = String(formData.get("exifFNumber") ?? "");
    const exifExposureProgramRaw = String(formData.get("exifExposureProgram") ?? "");
    const exifExposureTimeRaw = String(formData.get("exifExposureTime") ?? "");

    if (!title || !caption) {
      return NextResponse.json({ error: "title and caption are required" }, { status: 400 });
    }

    const width = parsePositiveNumber(widthRaw, "width");
    const height = parsePositiveNumber(heightRaw, "height");
    const tags = parseTags(tagsRaw);
    const exifLastUsedAt = parseOptionalDateTime(exifLastUsedAtRaw, "exifLastUsedAt");
    const exifMake = parseOptionalText(exifMakeRaw);
    const exifModel = parseOptionalText(exifModelRaw);
    const exifLensModel = parseOptionalText(exifLensModelRaw);
    const exifIso = parseOptionalNumber(exifIsoRaw, "exifIso");
    const exifColorSpace = parseOptionalText(exifColorSpaceRaw);
    const exifColorProfile = parseOptionalText(exifColorProfileRaw);
    const exifFocalLengthMm = parseOptionalNumber(exifFocalLengthRaw, "exifFocalLengthMm");
    const exifAlphaChannel = parseOptionalBoolean(exifAlphaChannelRaw, "exifAlphaChannel");
    const exifRedEye = parseOptionalBoolean(exifRedEyeRaw, "exifRedEye");
    const exifMeteringMode = parseOptionalText(exifMeteringModeRaw);
    const exifFNumber = parseOptionalNumber(exifFNumberRaw, "exifFNumber");
    const exifExposureProgram = parseOptionalText(exifExposureProgramRaw);
    const exifExposureTime = parseOptionalText(exifExposureTimeRaw);
    const takenAt = parseOptionalDate(takenAtRaw, "takenAt");
    const slug = toSlug(slugRaw || title || file.name.replace(/\.[^.]+$/, "")) || `photo-${Date.now()}`;

    const fileName = `${sanitizeFileBaseName(slug)}-${Date.now()}.webp`;
    const supabase = createServiceRoleClient();

    const inputBytes = Buffer.from(await file.arrayBuffer());
    const transformed = await ensureMinimumResolution({
      bytes: inputBytes,
      quality: WEBP_QUALITY_UPLOAD,
      outputFormat: "webp",
      enforceMinimum: true,
      fallbackWidth: width,
      fallbackHeight: height,
    });
    const bytes = transformed.data;
    const contentType = "image/webp";
    const outputWidth = transformed.width;
    const outputHeight = transformed.height;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, {
        upsert: false,
        contentType,
        cacheControl: "31536000",
      });

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
      width: outputWidth,
      height: outputHeight,
      title,
      caption,
      tags,
      taken_at: takenAt,
      created_at: nowIso,
      exif_last_used_at: exifLastUsedAt,
      exif_make: exifMake,
      exif_model: exifModel,
      exif_lens_model: exifLensModel,
      exif_iso: exifIso,
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
    return NextResponse.json({
      ok: true,
      id,
      slug,
      src,
      transformed: transformed.upscaled,
      finalWidth: outputWidth,
      finalHeight: outputHeight,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
