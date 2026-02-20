import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "photos";
const MIN_SHORT_SIDE = 2000;
const MIN_LONG_SIDE = 3000;
const WEBP_QUALITY_UPLOAD = 80;
const UPSCALE_KERNEL = "lanczos3";
const CONCURRENCY = 3;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseMode() {
  const value = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--mode="))
    ?.split("=")[1];

  if (!value || value === "replace") {
    return "replace";
  }

  if (value === "versioned") {
    return "versioned";
  }

  throw new Error(`Unsupported mode: ${value}. Use --mode=replace or --mode=versioned`);
}

function splitPathFromSrc(src) {
  const marker = "/storage/v1/object/public/photos/";
  const index = src.indexOf(marker);
  if (index < 0) return null;
  return src.slice(index + marker.length);
}

function normalizeResolution(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error("Invalid width/height");
  }

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const scale = Math.max(MIN_SHORT_SIDE / shortSide, MIN_LONG_SIDE / longSide, 1);

  return {
    shortSide,
    longSide,
    shouldUpscale: scale > 1,
    targetWidth: Math.max(1, Math.round(width * scale)),
    targetHeight: Math.max(1, Math.round(height * scale)),
  };
}

async function ensureMinimumResolution(bytes, fallbackWidth, fallbackHeight) {
  const metadata = await sharp(bytes).rotate().metadata();
  const width = metadata.width ?? fallbackWidth;
  const height = metadata.height ?? fallbackHeight;
  if (!width || !height) {
    throw new Error("Unable to determine image dimensions");
  }

  const normalized = normalizeResolution(width, height);
  let pipeline = sharp(bytes).rotate();

  if (normalized.shouldUpscale) {
    pipeline = pipeline.resize({
      width: normalized.targetWidth,
      height: normalized.targetHeight,
      fit: "fill",
      kernel: UPSCALE_KERNEL,
      withoutEnlargement: false,
    });
  }

  const transformed = await pipeline
    .webp({ quality: WEBP_QUALITY_UPLOAD, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    data: transformed.data,
    width: transformed.info.width ?? normalized.targetWidth,
    height: transformed.info.height ?? normalized.targetHeight,
    upscaled: normalized.shouldUpscale,
    alreadySatisfied: !normalized.shouldUpscale,
  };
}

function buildNextPath(row, mode) {
  const current = row.storage_path ?? splitPathFromSrc(row.src) ?? `${row.slug}.webp`;
  const base = current.replace(/\.[^.]+$/, "");
  if (mode === "replace") {
    return `${base}.webp`;
  }
  return `${base}-v2.webp`;
}

async function fetchSourceBuffer(row) {
  const response = await fetch(row.src, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Source fetch failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function processRow(supabase, row, mode) {
  const startedAt = Date.now();
  const sourceBuffer = await fetchSourceBuffer(row);
  const processed = await ensureMinimumResolution(sourceBuffer, row.width, row.height);

  const nextPath = buildNextPath(row, mode);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(nextPath, processed.data, {
    upsert: mode === "replace",
    contentType: "image/webp",
  });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(nextPath);
  const { error: updateError } = await supabase
    .from("photos")
    .update({
      src: publicUrlData.publicUrl,
      storage_path: nextPath,
      width: processed.width,
      height: processed.height,
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(`DB update failed: ${updateError.message}`);
  }

  return {
    id: row.id,
    slug: row.slug,
    upscaled: processed.upscaled,
    width: processed.width,
    height: processed.height,
    elapsedMs: Date.now() - startedAt,
  };
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  const failures = [];
  let cursor = 0;

  async function consume() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try {
        const result = await worker(item);
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        failures.push({ item, message });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, limit) }, () => consume()));
  return { results, failures };
}

async function main() {
  const mode = parseMode();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("photos")
    .select("id, slug, src, storage_path, width, height")
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed reading photos rows: ${error.message}`);
  }

  const rows = data ?? [];
  console.log(`Starting backfill for ${rows.length} photos (mode=${mode}, concurrency=${CONCURRENCY})`);

  const startedAt = Date.now();
  const { results, failures } = await runWithConcurrency(rows, CONCURRENCY, (row) =>
    processRow(supabase, row, mode)
  );

  const transformedCount = results.filter((item) => item.upscaled).length;
  const totalElapsedMs = Date.now() - startedAt;
  const averageMs = results.length > 0 ? Math.round(totalElapsedMs / results.length) : 0;

  console.log(`Processed: ${results.length}`);
  console.log(`Transformed (upscaled): ${transformedCount}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Average time per image: ${averageMs}ms`);

  if (failures.length > 0) {
    console.log("Failed items:");
    for (const failure of failures) {
      console.log(`- id=${failure.item.id} slug=${failure.item.slug} reason=${failure.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
