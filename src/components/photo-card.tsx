"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Photo } from "@/types/photo";

type Props = {
  photo: Photo;
};

const LIKES_STORAGE_KEY = "photo_blog_likes";
const LIKE_COUNTS_STORAGE_KEY = "photo_blog_like_counts";
const LIKES_CHANGED_EVENT = "photo-blog-likes-changed";

type LikeSnapshot = {
  liked: boolean;
  likeCount: number;
};
const SERVER_SNAPSHOT = "0:0";

function readLikeSnapshot(slug: string): LikeSnapshot {
  if (typeof window === "undefined") {
    return { liked: false, likeCount: 0 };
  }

  try {
    const rawLikes = window.localStorage.getItem(LIKES_STORAGE_KEY);
    const rawCounts = window.localStorage.getItem(LIKE_COUNTS_STORAGE_KEY);
    const likedSlugs = rawLikes ? (JSON.parse(rawLikes) as string[]) : [];
    const counts = rawCounts ? (JSON.parse(rawCounts) as Record<string, number>) : {};

    return {
      liked: likedSlugs.includes(slug),
      likeCount: Math.max(0, counts[slug] ?? 0),
    };
  } catch {
    return { liked: false, likeCount: 0 };
  }
}

function toSnapshotValue(snapshot: LikeSnapshot): string {
  return `${snapshot.liked ? 1 : 0}:${snapshot.likeCount}`;
}

function fromSnapshotValue(value: string): LikeSnapshot {
  const [likedRaw, countRaw] = value.split(":");
  const liked = likedRaw === "1";
  const likeCount = Math.max(0, Number.parseInt(countRaw ?? "0", 10) || 0);
  return { liked, likeCount };
}

function subscribeToLikes(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => { };
  }

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === LIKES_STORAGE_KEY || event.key === LIKE_COUNTS_STORAGE_KEY) {
      onStoreChange();
    }
  };

  const onLocalChange = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(LIKES_CHANGED_EVENT, onLocalChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LIKES_CHANGED_EVENT, onLocalChange);
  };
}

export function PhotoCard({ photo }: Props) {
  const snapshotValue = useSyncExternalStore(
    subscribeToLikes,
    () => toSnapshotValue(readLikeSnapshot(photo.slug)),
    () => SERVER_SNAPSHOT,
  );
  const { liked, likeCount } = fromSnapshotValue(snapshotValue);

  const toggleLike = () => {
    const nextLiked = !liked;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));

    try {
      const raw = window.localStorage.getItem(LIKES_STORAGE_KEY);
      const likedSlugs = raw ? (JSON.parse(raw) as string[]) : [];
      const merged = nextLiked
        ? Array.from(new Set([...likedSlugs, photo.slug]))
        : likedSlugs.filter((slug) => slug !== photo.slug);
      window.localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(merged));

      const rawCounts = window.localStorage.getItem(LIKE_COUNTS_STORAGE_KEY);
      const counts = rawCounts ? (JSON.parse(rawCounts) as Record<string, number>) : {};
      counts[photo.slug] = nextCount;
      window.localStorage.setItem(LIKE_COUNTS_STORAGE_KEY, JSON.stringify(counts));
      window.dispatchEvent(new Event(LIKES_CHANGED_EVENT));
    } catch {
      // noop: localStorage may be unavailable in private mode
    }
  };

  return (
    <article className="group relative mb-4 break-inside-avoid overflow-hidden ring-1 ring-stone-900/5 shadow-sm bg-stone-100">
      <Link href={`/photo/${photo.slug}`} className="block overflow-hidden">
        <Image
          src={photo.src}
          alt={photo.title}
          width={photo.width}
          height={photo.height}
          className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
          decoding="async"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </Link>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/8 to-transparent opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-within:opacity-100" />

        <div className="relative flex h-full flex-col justify-between p-4">
          <div className="pointer-events-auto flex items-start justify-between opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              aria-label={liked ? "좋아요 취소" : "좋아요"}
              onClick={toggleLike}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 px-3.5 text-white/95 shadow-sm transition hover:bg-white/30"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className={`h-5 w-5 ${liked ? "fill-red-500 stroke-red-500" : "fill-transparent stroke-white drop-shadow-sm"}`}
              >
                <path
                  d="M12 21s-6.7-4.35-9.33-8.2C.7 9.95 1.35 6.1 4.8 4.75c2.2-.86 4.26.04 5.47 1.67C11.48 4.79 13.54 3.9 15.74 4.75c3.45 1.35 4.1 5.2 2.13 8.05C15.24 16.65 12 21 12 21Z"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="text-xs font-semibold tabular-nums drop-shadow-md">{likeCount}</span>
            </button>

            <a
              href={`/api/photos/${photo.slug}/download`}
              aria-label="사진 다운로드"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white/95 shadow-sm transition hover:bg-white/30"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current drop-shadow-sm" strokeWidth="1.8">
                <path d="M12 3v11" />
                <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
                <path d="M4 18.5h16" />
              </svg>
            </a>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="flex flex-col items-start gap-1.5">
            <h2 className="max-w-[72%] rounded-xl border border-white/35 bg-white/12 px-3 py-1.5 text-sm font-bold tracking-tight text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_rgba(0,0,0,0.3)] drop-shadow-md opacity-0 translate-y-1 transition-all duration-300 ease-out will-change-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {photo.title}
            </h2>
            <p className="max-w-[84%] rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-medium text-white/95 leading-relaxed backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.28)] drop-shadow-md line-clamp-2 opacity-0 translate-y-1 transition-all duration-300 ease-out [transition-delay:40ms] will-change-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {photo.caption}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
