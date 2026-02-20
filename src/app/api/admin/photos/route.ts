import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ensureMinimumResolution, WEBP_QUALITY_UPLOAD } from "@/lib/image-resolution";
import { invalidatePhotosCache } from "@/lib/photos";

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

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name];
  return value ? value : null;
}

function parseBooleanEnv(name: string): boolean {
  const value = getOptionalEnv(name);
  if (!value) {
    return false;
  }
  return value.trim().toLowerCase() === "true";
}

function getMaxUploadSizeBytes(): number {
  const value = getOptionalEnv("ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES");
  if (!value) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }

  return Math.floor(parsed);
}

function safeTokenEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function parseAllowedEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

async function authorizeAdmin(
  request: Request,
  formData: FormData
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const allowLegacyToken = parseBooleanEnv("ADMIN_UPLOAD_LEGACY_TOKEN_ENABLED");
  const legacyToken = getOptionalEnv("ADMIN_UPLOAD_TOKEN");
  const formToken = String(formData.get("token") ?? "").trim();
  if (allowLegacyToken && legacyToken && formToken && safeTokenEquals(formToken, legacyToken)) {
    return { ok: true };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getRequiredEnv("SUPABASE_URL");
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null;
  const allowedEmailsRaw = getOptionalEnv("ADMIN_ALLOWED_EMAILS");

  if (!publishableKey) {
    return {
      ok: false,
      status: 500,
      error: "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for admin auth",
    };
  }

  if (!allowedEmailsRaw) {
    return {
      ok: false,
      status: 500,
      error: "Missing ADMIN_ALLOWED_EMAILS for admin auth",
    };
  }

  const allowedEmails = parseAllowedEmails(allowedEmailsRaw);
  if (allowedEmails.size === 0) {
    return {
      ok: false,
      status: 500,
      error: "ADMIN_ALLOWED_EMAILS is empty",
    };
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const email = data.user.email.toLowerCase();
  if (!allowedEmails.has(email)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
    };
  }

  return { ok: true };
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

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
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
    const authResult = await authorizeAdmin(request, formData);
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
    if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
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
      return NextResponse.json(
        { error: "title and caption are required" },
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
    const takenAt = parseOptionalDate(takenAtRaw, "takenAt");
    const slug = toSlug(slugRaw || title || file.name.replace(/\.[^.]+$/, "")) || `photo-${Date.now()}`;

    const fileName = `${sanitizeFileBaseName(slug)}-${Date.now()}.webp`;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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
