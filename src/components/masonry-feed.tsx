"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoCard } from "@/components/photo-card";
import type { Photo, PhotoListResponse } from "@/types/photo";

type Props = {
  initialItems: Photo[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
};

export function MasonryFeed({
  initialItems,
  initialHasMore,
  initialNextCursor,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const observerRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "15");

      if (nextCursor) {
        params.set("cursor", nextCursor);
      }

      const response = await fetch(`/api/photos?${params.toString()}`);

      if (!response.ok) {
        throw new Error("사진을 더 불러오지 못했습니다.");
      }

      const data = (await response.json()) as PhotoListResponse;

      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const next = data.items.filter((item) => !seen.has(item.id));
        return [...prev, ...next];
      });
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "알 수 없는 오류";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, nextCursor]);

  useEffect(() => {
    if (!observerRef.current || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const countText = useMemo(() => `${items.length} photos`, [items.length]);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{countText}</p>
      </div>

      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {items.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>

      <div ref={observerRef} className="mt-4 h-10" aria-hidden />

      <div className="flex min-h-10 items-center justify-center pb-10">
        {isLoading && <p className="text-sm text-stone-500">사진을 불러오는 중...</p>}
        {!isLoading && error && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            다시 시도
          </button>
        )}
        {!isLoading && !hasMore && (
          <p className="text-sm text-stone-500">모든 사진을 확인했어요.</p>
        )}
      </div>
    </section>
  );
}
