import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data", "photos.json");
const TABLE = "photos";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function toStoragePath(src) {
  return src.replace(/^\/photos\//, "");
}

async function main() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in environment"
    );
  }

  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const raw = await readFile(DATA_FILE, "utf-8");
  const records = JSON.parse(raw);

  if (!Array.isArray(records)) {
    throw new Error("Invalid photos.json format: expected array");
  }

  const payload = records.map((item) => ({
    id: item.id,
    slug: item.slug,
    src: item.src,
    storage_path: toStoragePath(item.src),
    width: item.width,
    height: item.height,
    title: item.title,
    caption: item.caption,
    tags: item.tags,
    taken_at: item.takenAt,
    created_at: item.createdAt,
  }));

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "slug" });

  if (error) {
    if (
      error.message?.includes("Could not find the table 'public.photos'") ||
      error.code === "PGRST205"
    ) {
      throw new Error(
        "Import failed: public.photos table is missing. Run supabase/migrations/0001_create_photos.sql in Supabase SQL Editor first."
      );
    }

    throw new Error(`Import failed: ${error.message}`);
  }

  console.log(`Imported ${payload.length} records into public.${TABLE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
