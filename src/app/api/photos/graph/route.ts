import { NextResponse } from "next/server";
import { getAllPhotos } from "@/lib/photos";
import type { GraphLink, GraphNode, PhotoGraphResponse } from "@/types/graph";

const TOP_TAGS_LIMIT = 30;
const MIN_TAG_FREQ_DEFAULT = 1;
const MIN_TAG_FREQ_MIN = 1;
const MIN_TAG_FREQ_MAX = 20;

function normalizeMinTagFreq(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return MIN_TAG_FREQ_DEFAULT;
  }
  return Math.max(MIN_TAG_FREQ_MIN, Math.min(MIN_TAG_FREQ_MAX, Math.floor(parsed)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minTagFreq = normalizeMinTagFreq(searchParams.get("minTagFreq"));

  const photos = await getAllPhotos();
  const tagCounts = new Map<string, number>();

  for (const photo of photos) {
    for (const rawTag of photo.tags) {
      const tag = rawTag.trim();
      if (!tag) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_TAGS_LIMIT)
    .filter(([, count]) => count >= minTagFreq);
  const includedTags = new Set(topTags.map(([tag]) => tag));

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  for (const [tag, count] of topTags) {
    nodes.push({
      id: `tag:${tag}`,
      type: "tag",
      tag,
      count,
    });
  }

  for (const photo of photos) {
    const matchedTags = photo.tags.filter((tag) => includedTags.has(tag.trim()));
    if (matchedTags.length === 0) {
      continue;
    }

    nodes.push({
      id: `photo:${photo.id}`,
      type: "photo",
      photoId: photo.id,
      slug: photo.slug,
      title: photo.title,
      src: photo.src,
    });

    for (const tag of matchedTags) {
      links.push({
        source: `photo:${photo.id}`,
        target: `tag:${tag.trim()}`,
        weight: 1,
      });
    }
  }

  const response: PhotoGraphResponse = {
    nodes,
    links,
    meta: {
      totalPhotos: photos.length,
      totalTags: tagCounts.size,
      topTagsLimit: TOP_TAGS_LIMIT,
      minTagFreq,
    },
  };

  return NextResponse.json(response);
}
