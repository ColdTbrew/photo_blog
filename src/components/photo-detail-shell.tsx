"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentAccessToken, useAdminSession } from "@/lib/admin-auth-client";
import type { Photo } from "@/types/photo";

type Props = {
  photo: Photo;
};

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function toDateValue(input: string | null): string {
  if (!input) return "";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatExifNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatExposureTime(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return /s$/i.test(trimmed) ? trimmed : `${trimmed}s`;
}

function buildExifSummary(photo: Photo): string {
  const parts: string[] = [];

  if (photo.exifMake) parts.push(photo.exifMake);
  if (photo.exifModel) parts.push(photo.exifModel);
  if (photo.exifLensModel) parts.push(photo.exifLensModel);

  const iso = formatExifNumber(photo.exifIso);
  if (iso) parts.push(`ISO ${iso}`);

  const focalLength = formatExifNumber(photo.exifFocalLengthMm);
  if (focalLength) parts.push(`${focalLength}mm`);

  const fNumber = formatExifNumber(photo.exifFNumber);
  if (fNumber) parts.push(`F${fNumber}`);

  const exposureTime = formatExposureTime(photo.exifExposureTime);
  if (exposureTime) parts.push(exposureTime);

  return parts.join(" · ");
}

export function PhotoDetailShell({ photo }: Props) {
  const router = useRouter();
  const cardRef = useRef<HTMLElement | null>(null);
  const { isAdmin, session } = useAdminSession();

  const [current, setCurrent] = useState(photo);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const [title, setTitle] = useState(photo.title);
  const [slug, setSlug] = useState(photo.slug);
  const [caption, setCaption] = useState(photo.caption);
  const [tags, setTags] = useState(photo.tags.join(", "));
  const [takenAt, setTakenAt] = useState(toDateValue(photo.takenAt));
  const exifSummary = buildExifSummary(current);

  useEffect(() => {
    setCurrent(photo);
    setTitle(photo.title);
    setSlug(photo.slug);
    setCaption(photo.caption);
    setTags(photo.tags.join(", "));
    setTakenAt(toDateValue(photo.takenAt));
    setIsEditOpen(false);
    setIsDeleteOpen(false);
    setDeleteConfirmText("");
    setStatus({ type: "idle" });
  }, [photo]);

  const closeDetail = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  const onBackgroundClick: React.MouseEventHandler<HTMLElement> = (event) => {
    if (isEditOpen || isDeleteOpen) {
      return;
    }

    const target = event.target as Node;
    if (target instanceof Element && target.closest('[data-prevent-detail-close="true"]')) {
      return;
    }

    if (!cardRef.current?.contains(target)) {
      closeDetail();
    }
  };

  const onSave = async () => {
    const accessToken = (await getCurrentAccessToken()) ?? session?.access_token ?? null;
    if (!accessToken) {
      setStatus({ type: "error", message: "관리자 로그인이 필요합니다." });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const response = await fetch(`/api/admin/photos/${current.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          slug,
          caption,
          tags: parseTagsInput(tags),
          takenAt: takenAt || null,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        slug?: string;
        photo?: Photo;
      };

      if (response.status === 401 || response.status === 403) {
        throw new Error("관리자 권한이 없습니다. 다시 로그인해 주세요.");
      }

      if (!response.ok || !data.photo || !data.slug) {
        throw new Error(data.error ?? "수정에 실패했습니다.");
      }

      const previousSlug = current.slug;
      setCurrent(data.photo);
      setStatus({ type: "success", message: "사진 정보가 수정되었습니다." });
      setIsEditOpen(false);

      if (data.slug !== previousSlug) {
        router.replace(`/photo/${data.slug}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setStatus({ type: "error", message });
    }
  };

  const onDelete = async () => {
    const accessToken = (await getCurrentAccessToken()) ?? session?.access_token ?? null;
    if (!accessToken) {
      setStatus({ type: "error", message: "관리자 로그인이 필요합니다." });
      return;
    }

    if (deleteConfirmText !== "DELETE") {
      setStatus({ type: "error", message: "삭제 확인 텍스트로 DELETE를 입력해 주세요." });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const response = await fetch(`/api/admin/photos/${current.slug}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = (await response.json()) as { error?: string; partialWarning?: string | null };
      if (response.status === 401 || response.status === 403) {
        throw new Error("관리자 권한이 없습니다. 다시 로그인해 주세요.");
      }

      if (!response.ok) {
        throw new Error(data.error ?? "삭제에 실패했습니다.");
      }

      if (data.partialWarning) {
        setStatus({
          type: "success",
          message: `사진은 삭제됐지만 스토리지 정리에 경고가 있습니다: ${data.partialWarning}`,
        });
      }

      router.push("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setStatus({ type: "error", message });
    }
  };

  return (
    <main
      onClick={onBackgroundClick}
      className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8"
      aria-label="photo detail"
    >
      <div className="flex items-center justify-between gap-3" data-prevent-detail-close="true">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
        >
          ← Back to feed
        </Link>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <article ref={cardRef} className="mt-6 bg-white shadow-sm ring-1 ring-stone-200">
        <Image
          src={current.src}
          alt={current.title}
          width={current.width}
          height={current.height}
          className="h-auto w-full"
          priority
        />

        <div className="space-y-4 p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
              {current.takenAt ?? "unknown date"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              {current.title}
            </h1>
          </div>

          <p className="text-base text-stone-700">{current.caption}</p>

          {exifSummary && <p className="text-sm text-stone-600">{exifSummary}</p>}

          <ul className="flex flex-wrap gap-2">
            {current.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-stone-300 px-3 py-1 text-xs uppercase tracking-[0.12em] text-stone-600"
              >
                {tag}
              </li>
            ))}
          </ul>

          {status.type === "error" && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {status.message}
            </p>
          )}
          {status.type === "success" && (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {status.message}
            </p>
          )}
        </div>
      </article>

      {isEditOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
            data-prevent-detail-close="true"
          >
            <h2 className="text-xl font-semibold text-stone-900">사진 편집</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">Slug</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Caption</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">Tags</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="comma,separated,tags"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">Taken At</span>
                <input
                  type="date"
                  value={takenAt}
                  onChange={(event) => setTakenAt(event.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={status.type === "loading"}
                className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {status.type === "loading" ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </section>
      )}

      {isDeleteOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
            data-prevent-detail-close="true"
          >
            <h2 className="text-xl font-semibold text-stone-900">사진 삭제</h2>
            <p className="text-sm text-stone-700">
              이 작업은 되돌릴 수 없습니다. 확인을 위해 아래 입력에 <strong>DELETE</strong>를 입력해 주세요.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              placeholder="DELETE"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setDeleteConfirmText("");
                }}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={status.type === "loading"}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {status.type === "loading" ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
