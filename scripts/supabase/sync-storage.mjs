import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const LOCAL_PHOTOS_DIR = path.join(ROOT, "public", "photos");
const BUCKET = "photos";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function guessContentType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

async function uploadAllLocalPhotos(supabase) {
  const { data, error } = await supabase.from("photos").select("storage_path");
  if (error) {
    throw new Error(`Failed reading photo storage paths: ${error.message}`);
  }

  const files = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.storage_path)
        .filter((storagePath) => typeof storagePath === "string" && storagePath.length > 0)
    )
  );

  for (const fileName of files) {
    const filePath = path.join(LOCAL_PHOTOS_DIR, fileName);
    const body = await readFile(filePath);
    const contentType = guessContentType(fileName);

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, body, {
      upsert: true,
      contentType,
    });

    if (error) {
      throw new Error(`Storage upload failed for ${fileName}: ${error.message}`);
    }
  }

  return files.length;
}

async function rewritePhotoSrcToPublicUrl(supabase) {
  const { data, error } = await supabase.from("photos").select("id, storage_path");

  if (error) {
    throw new Error(`Failed reading photos rows: ${error.message}`);
  }

  const rows = data ?? [];
  let updated = 0;

  for (const row of rows) {
    const storagePath = row.storage_path;
    if (!storagePath) continue;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const src = urlData.publicUrl;

    const { error: updateError } = await supabase.from("photos").update({ src }).eq("id", row.id);
    if (updateError) {
      throw new Error(`Failed updating src for id=${row.id}: ${updateError.message}`);
    }
    updated += 1;
  }

  return updated;
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const uploadedCount = await uploadAllLocalPhotos(supabase);
  const updatedCount = await rewritePhotoSrcToPublicUrl(supabase);

  console.log(`Uploaded ${uploadedCount} files to storage bucket '${BUCKET}'`);
  console.log(`Updated src for ${updatedCount} photo rows`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
