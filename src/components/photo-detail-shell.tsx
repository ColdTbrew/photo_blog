"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Photo } from "@/types/photo";

type Props = {
  photo: Photo;
};

export function PhotoDetailShell({ photo }: Props) {
  const router = useRouter();
  const cardRef = useRef<HTMLElement | null>(null);

  const closeDetail = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  const onBackgroundClick: React.MouseEventHandler<HTMLElement> = (event) => {
    const target = event.target as Node;

    if (!cardRef.current?.contains(target)) {
      closeDetail();
    }
  };

  return (
    <main
      onClick={onBackgroundClick}
      className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8"
      aria-label="photo detail"
    >
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
      >
        ← Back to feed
      </Link>

      <article ref={cardRef} className="mt-6 bg-white shadow-sm ring-1 ring-stone-200">
        <Image
          src={photo.src}
          alt={photo.title}
          width={photo.width}
          height={photo.height}
          className="h-auto w-full"
          priority
        />

        <div className="space-y-4 p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
              {photo.takenAt ?? "unknown date"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              {photo.title}
            </h1>
          </div>

          <p className="text-base text-stone-700">{photo.caption}</p>

          <ul className="flex flex-wrap gap-2">
            {photo.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-stone-300 px-3 py-1 text-xs uppercase tracking-[0.12em] text-stone-600"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </main>
  );
}
