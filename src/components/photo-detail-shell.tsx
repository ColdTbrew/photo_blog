"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentAccessToken, useAdminSession } from "@/lib/admin-auth-client";
import type { Photo } from "@/types/photo";

type Props = {
  photo: Photo;
};

type AiSuggestion = {
  title: string;
  slug: string;
  caption: string;
  tags: string[];
};

type AiSuggestErrorResponse = {
  error?: string;
  model?: string;
  openaiStatus?: number;
  openaiType?: string;
  openaiCode?: string;
  openaiParam?: string;
  openaiRequestId?: string;
};

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const AI_IMAGE_MAX_DIMENSION = 256;
const AI_IMAGE_JPEG_QUALITY = 0.82;
const AI_IMAGE_TARGET_MIME = "image/jpeg";

function parseTagsInput(raw: string): string[] {
  const dedup = new Set(
    raw
    .replace(/\r\n/g, "\n")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
  );

  return [...dedup];
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

async function createAiSuggestionImage(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  let sourceUrl: string | null = null;
  try {
    sourceUrl = URL.createObjectURL(file);
    const objectUrl = sourceUrl;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image-load-failed"));
      img.src = objectUrl;
    });

    const originalWidth = image.naturalWidth || 0;
    const originalHeight = image.naturalHeight || 0;
    if (originalWidth <= 0 || originalHeight <= 0) {
      return file;
    }

    const maxSide = Math.max(originalWidth, originalHeight);
    const scale = maxSide > AI_IMAGE_MAX_DIMENSION ? AI_IMAGE_MAX_DIMENSION / maxSide : 1;
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, AI_IMAGE_TARGET_MIME, AI_IMAGE_JPEG_QUALITY);
    });
    if (!blob) {
      return file;
    }

    const lastDot = file.name.lastIndexOf(".");
    const baseName = lastDot > 0 ? file.name.slice(0, lastDot) : file.name;
    return new File([blob], `${baseName}-ai.jpg`, {
      type: AI_IMAGE_TARGET_MIME,
      lastModified: Date.now(),
    });
  } catch {
    // Keep request alive with original file if preview conversion fails in browser.
    return file;
  } finally {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
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
  const [aiSuggestStatus, setAiSuggestStatus] = useState<Status>({ type: "idle" });
  const [aiPrompt, setAiPrompt] = useState("");

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
    setAiSuggestStatus({ type: "idle" });
    setAiPrompt("");
  }, [photo]);

  const onResuggest = async () => {
    const accessToken = (await getCurrentAccessToken()) ?? session?.access_token ?? null;
    if (!accessToken) {
      setAiSuggestStatus({ type: "error", message: "AI 재추천은 관리자 로그인 후 사용할 수 있습니다." });
      return;
    }

    setAiSuggestStatus({ type: "loading" });

    try {
      const sourceResponse = await fetch(current.src);
      if (!sourceResponse.ok) {
        throw new Error("원본 이미지를 불러오지 못했습니다.");
      }

      const sourceBlob = await sourceResponse.blob();
      const sourceMimeType = sourceBlob.type || "image/jpeg";
      const sourceFile = new File([sourceBlob], `${current.slug}.jpg`, {
        type: sourceMimeType,
        lastModified: Date.now(),
      });
      const aiFile = await createAiSuggestionImage(sourceFile);

      const formData = new FormData();
      formData.set("file", aiFile);
      formData.set("prompt", aiPrompt.trim());

      const response = await fetch("/api/admin/photos/ai-suggest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = (await response.json()) as (AiSuggestion & AiSuggestErrorResponse);
      if (!response.ok) {
        const details = [
          typeof data.openaiStatus === "number" ? `status=${data.openaiStatus}` : "",
          data.openaiType ? `type=${data.openaiType}` : "",
          data.openaiCode ? `code=${data.openaiCode}` : "",
          data.openaiParam ? `param=${data.openaiParam}` : "",
          data.model ? `model=${data.model}` : "",
          data.openaiRequestId ? `request_id=${data.openaiRequestId}` : "",
        ].filter(Boolean);
        const message = data.error ?? "AI 재추천에 실패했습니다.";
        throw new Error(details.length ? `${message} (${details.join(", ")})` : message);
      }

      setTitle(data.title ?? "");
      setSlug(data.slug ?? "");
      setCaption(data.caption ?? "");
      setTags(Array.isArray(data.tags) ? data.tags.join(", ") : "");
      setAiSuggestStatus({ type: "success", message: "제목/슬러그/캡션/태그를 AI 추천값으로 업데이트했습니다." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setAiSuggestStatus({ type: "error", message });
    }
  };

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
        <NextImage
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

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => void onResuggest()}
                disabled={aiSuggestStatus.type === "loading" || status.type === "loading"}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100 disabled:opacity-60"
              >
                {aiSuggestStatus.type === "loading" ? "AI 재추천 중..." : "AI로 제목/태그 재추천"}
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">AI 추가 프롬프트 (선택)</span>
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                rows={2}
                placeholder="예: 차분한 톤, 야간 촬영 느낌을 강조해줘"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>

            {aiSuggestStatus.type === "error" && (
              <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {aiSuggestStatus.message}
              </p>
            )}
            {aiSuggestStatus.type === "success" && (
              <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {aiSuggestStatus.message}
              </p>
            )}

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
                  placeholder="쉼표 또는 줄바꿈으로 태그 구분"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-xs text-stone-500">
                  예: `샌프란시스코, 워터프론트` 또는 줄바꿈으로 여러 태그 입력
                </span>
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
