import { promises as fs } from "node:fs";
import path from "node:path";
import type { Photo, PhotoListResponse } from "@/types/photo";

const DATA_FILE = path.join(process.cwd(), "data", "photos.json");
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function isPhoto(value: unknown): value is Photo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<Photo>;

  return (
    typeof item.id === "string" &&
    typeof item.slug === "string" &&
    typeof item.src === "string" &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    typeof item.title === "string" &&
    typeof item.caption === "string" &&
    Array.isArray(item.tags) &&
    item.tags.every((tag) => typeof tag === "string") &&
    typeof item.takenAt === "string" &&
    typeof item.createdAt === "string"
  );
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

let cache: Photo[] | null = null;

export async function getAllPhotos(): Promise<Photo[]> {
  if (cache) {
    return cache;
  }

  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid photos data: expected an array");
  }

  const photos = parsed.filter(isPhoto);

  if (photos.length !== parsed.length) {
    console.warn("[photos] some items were ignored due to invalid shape");
  }

  photos.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  warnDuplicateSlugs(photos);
  cache = photos;

  return photos;
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
