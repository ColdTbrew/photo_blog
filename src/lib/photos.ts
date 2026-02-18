import { createClient } from "@supabase/supabase-js";
import type { Photo, PhotoListResponse } from "@/types/photo";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

type PhotoRow = {
  id: string;
  slug: string;
  src: string;
  storage_path: string | null;
  width: number;
  height: number;
  title: string;
  caption: string;
  tags: string[];
  taken_at: string;
  created_at: string;
};

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function warnDuplicateSlugs(items: Photo[]): void {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.slug)) {
      console.warn(`[photos] duplicate slug detected: ${item.slug}`);
      continue;
    }

    seen.add(item.slug);
  }
}

export function invalidatePhotosCache() {
  // no-op: kept for compatibility with admin upload route
}

function getSupabaseReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapRowToPhoto(row: PhotoRow): Photo {
  return {
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
  };
}

async function getAllPhotosFromSupabase(): Promise<Photo[]> {
  const client = getSupabaseReadClient();

  if (!client) {
    throw new Error(
      "Supabase read env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const { data, error } = await client
    .from("photos")
    .select("id, slug, src, storage_path, width, height, title, caption, tags, taken_at, created_at")
    .order("created_at", { ascending: false })
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PhotoRow[];
  const photos = rows.map(mapRowToPhoto);
  warnDuplicateSlugs(photos);
  return photos;
}

export async function getAllPhotos(): Promise<Photo[]> {
  return await getAllPhotosFromSupabase();
}

export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  const photos = await getAllPhotos();
  return photos.find((photo) => photo.slug === slug) ?? null;
}

export async function getPhotosPage(input?: {
  cursor?: string;
  limit?: number;
}): Promise<PhotoListResponse> {
  const photos = await getAllPhotos();
  const limit = normalizeLimit(input?.limit);

  let startIndex = 0;

  if (input?.cursor) {
    const cursorIndex = photos.findIndex((photo) => photo.slug === input.cursor);

    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }

  const items = photos.slice(startIndex, startIndex + limit);
  const last = items.at(-1);
  const nextCursor = last?.slug ?? null;
  const hasMore = startIndex + items.length < photos.length;

  return {
    items,
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
  };
}
