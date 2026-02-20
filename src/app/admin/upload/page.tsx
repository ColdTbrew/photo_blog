"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type BooleanSelect = "" | "true" | "false";

type ExifFormState = {
  lastUsedAt: string;
  make: string;
  model: string;
  colorSpace: string;
  colorProfile: string;
  focalLengthMm: string;
  alphaChannel: BooleanSelect;
  redEye: BooleanSelect;
  meteringMode: string;
  fNumber: string;
  exposureProgram: string;
  exposureTime: string;
};

type ExtractedMetadata = {
  exif: ExifFormState;
  takenAt: string;
};

type AiSuggestion = {
  title: string;
  caption: string;
  tags: string[];
};

const EMPTY_EXIF: ExifFormState = {
  lastUsedAt: "",
  make: "",
  model: "",
  colorSpace: "",
  colorProfile: "",
  focalLengthMm: "",
  alphaChannel: "",
  redEye: "",
  meteringMode: "",
  fNumber: "",
  exposureProgram: "",
  exposureTime: "",
};

function firstDefined<T>(...values: T[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function toDatetimeLocalValue(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function toBooleanSelectValue(value: unknown): BooleanSelect {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return "";
}

function toOptionalNumberText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function mapColorSpace(value: unknown): string {
  if (value === 1) return "sRGB";
  if (value === 65535) return "Uncalibrated";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function mapExposureProgram(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  const byCode: Record<number, string> = {
    1: "manual",
    2: "normal program",
    3: "aperture priority",
    4: "shutter priority",
    5: "creative program",
    6: "action program",
    7: "portrait mode",
    8: "landscape mode",
  };

  return byCode[value] ?? String(value);
}

function mapMeteringMode(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  const byCode: Record<number, string> = {
    1: "average",
    2: "center weighted average",
    3: "spot",
    4: "multi spot",
    5: "pattern",
    6: "partial",
  };

  return byCode[value] ?? String(value);
}

function formatExposureTime(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";

  if (value >= 1) {
    return `${value}`;
  }

  const denominator = Math.round(1 / value);
  if (denominator > 0) {
    return `1/${denominator}`;
  }

  return `${value}`;
}

function getAlphaChannelFromMimeType(file: File): BooleanSelect {
  const mimeType = file.type.toLowerCase();
  if (mimeType === "image/jpeg" || mimeType === "image/jpg" || mimeType === "image/heic" || mimeType === "image/heif") {
    return "false";
  }
  return "";
}

async function extractExifFormState(file: File): Promise<ExifFormState> {
  const initial: ExifFormState = {
    ...EMPTY_EXIF,
    lastUsedAt: file.lastModified ? toDatetimeLocalValue(new Date(file.lastModified)) : "",
    alphaChannel: getAlphaChannelFromMimeType(file),
  };

  try {
    const exifr = await import("exifr");
    const parsed = (await exifr.parse(file, true)) as Record<string, unknown> | null;
    if (!parsed) {
      return initial;
    }

    const colorProfile = firstDefined(
      parsed.ProfileName,
      parsed.ICCProfileName,
      parsed.CurrentICCProfile,
      parsed.ColorProfile
    );
    const redEyeValue = firstDefined(
      parsed.RedEyeReduction,
      parsed.RedEyeMode,
      parsed.FlashRedEyeMode
    );

    return {
      ...initial,
      make: typeof parsed.Make === "string" ? parsed.Make : "",
      model: typeof parsed.Model === "string" ? parsed.Model : "",
      colorSpace: mapColorSpace(parsed.ColorSpace),
      colorProfile: typeof colorProfile === "string" ? colorProfile : "",
      focalLengthMm: toOptionalNumberText(parsed.FocalLength),
      alphaChannel: initial.alphaChannel,
      redEye: toBooleanSelectValue(redEyeValue),
      meteringMode: mapMeteringMode(parsed.MeteringMode),
      fNumber: toOptionalNumberText(firstDefined(parsed.FNumber, parsed.ApertureValue)),
      exposureProgram: mapExposureProgram(parsed.ExposureProgram),
      exposureTime: formatExposureTime(parsed.ExposureTime),
    };
  } catch {
    return initial;
  }
}

function toDateInputValue(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function parseExifDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateInputValue(value);
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateInputValue(parsed);
    }
  }
  return "";
}

async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  const exif = await extractExifFormState(file);
  let takenAt = "";

  try {
    const exifr = await import("exifr");
    const parsed = (await exifr.parse(file, true)) as Record<string, unknown> | null;
    if (parsed) {
      takenAt = parseExifDate(
        firstDefined(parsed.DateTimeOriginal, parsed.CreateDate, parsed.ModifyDate)
      );
    }
  } catch {
    // noop
  }

  return { exif, takenAt };
}

export default function AdminUploadPage() {
  const [authStatus, setAuthStatus] = useState<Status>({ type: "idle" });
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [takenAtNone, setTakenAtNone] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [exif, setExif] = useState<ExifFormState>(EMPTY_EXIF);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [aiStatus, setAiStatus] = useState<Status>({ type: "idle" });
  const [aiOverwriteExisting, setAiOverwriteExisting] = useState(false);

  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return null;
    }
    return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }, []);

  const hasAuthConfig = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
  const isAuthenticated = Boolean(session?.access_token);
  const suggestedSlug = useMemo(() => slugify(title), [title]);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const onSignInWithGitHub = async () => {
    if (!supabase) {
      setAuthStatus({
        type: "error",
        message: "Supabase 인증 설정이 없습니다. 환경변수를 확인해 주세요.",
      });
      return;
    }

    setAuthStatus({ type: "loading" });
    const redirectTo = `${window.location.origin}/admin/upload`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        scopes: "read:user user:email",
      },
    });
    if (error) {
      setAuthStatus({ type: "error", message: error.message });
      return;
    }

    setAuthStatus({ type: "success", message: "GitHub 로그인 페이지로 이동합니다..." });
  };

  const onSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setStatus({ type: "idle" });
    setAiStatus({ type: "idle" });
    setAuthStatus({ type: "idle" });
  };

  const applyAiSuggestion = (suggestion: AiSuggestion, overwrite: boolean) => {
    setTitle((prev) => (overwrite || !prev.trim() ? suggestion.title : prev));
    setCaption((prev) => (overwrite || !prev.trim() ? suggestion.caption : prev));
    setTags((prev) => (overwrite || !prev.trim() ? suggestion.tags.join(", ") : prev));
  };

  const requestAiSuggestion = async (targetFile: File, overwrite: boolean) => {
    if (!isAuthenticated || !session?.access_token) {
      setAiStatus({ type: "error", message: "AI 추천은 관리자 로그인 후 사용할 수 있습니다." });
      return;
    }

    setAiStatus({ type: "loading" });

    try {
      const formData = new FormData();
      formData.set("file", targetFile);

      const response = await fetch("/api/admin/photos/ai-suggest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = (await response.json()) as (AiSuggestion & { error?: string });
      if (!response.ok) {
        throw new Error(data.error ?? "AI 메타데이터 추천에 실패했습니다.");
      }

      applyAiSuggestion(data, overwrite);
      setAiStatus({ type: "success", message: "AI 추천 메타데이터를 불러왔습니다." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setAiStatus({ type: "error", message });
    }
  };

  const onFileChange = async (nextFile: File | null) => {
    setFile(nextFile);
    if (!nextFile) {
      setExif(EMPTY_EXIF);
      setAiStatus({ type: "idle" });
      return;
    }

    setAiStatus({ type: "idle" });

    try {
      const imageUrl = URL.createObjectURL(nextFile);
      const img = new Image();
      img.onload = () => {
        setWidth(String(img.naturalWidth));
        setHeight(String(img.naturalHeight));
        URL.revokeObjectURL(imageUrl);
      };
      img.src = imageUrl;
    } catch {
      // noop
    }

    const extracted = await extractMetadata(nextFile);
    setExif(extracted.exif);
    if (!takenAtNone) {
      setTakenAt((prev) => prev || extracted.takenAt);
    }

    if (isAuthenticated && session?.access_token) {
      await requestAiSuggestion(nextFile, aiOverwriteExisting);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ type: "loading" });

    if (!isAuthenticated || !session?.access_token) {
      setStatus({ type: "error", message: "먼저 관리자 계정으로 로그인해 주세요." });
      return;
    }

    if (!file) {
      setStatus({ type: "error", message: "이미지 파일을 선택해 주세요." });
      return;
    }

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("slug", slug || suggestedSlug);
      formData.set("caption", caption);
      formData.set("tags", tags);
      formData.set("takenAt", takenAtNone ? "none" : takenAt);
      formData.set("width", width);
      formData.set("height", height);
      formData.set("exifLastUsedAt", exif.lastUsedAt);
      formData.set("exifMake", exif.make);
      formData.set("exifModel", exif.model);
      formData.set("exifColorSpace", exif.colorSpace);
      formData.set("exifColorProfile", exif.colorProfile);
      formData.set("exifFocalLengthMm", exif.focalLengthMm);
      formData.set("exifAlphaChannel", exif.alphaChannel);
      formData.set("exifRedEye", exif.redEye);
      formData.set("exifMeteringMode", exif.meteringMode);
      formData.set("exifFNumber", exif.fNumber);
      formData.set("exifExposureProgram", exif.exposureProgram);
      formData.set("exifExposureTime", exif.exposureTime);
      formData.set("file", file);

      const response = await fetch("/api/admin/photos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        slug?: string;
        transformed?: boolean;
        finalWidth?: number;
        finalHeight?: number;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "업로드에 실패했습니다.");
      }

      const finalSize =
        typeof data.finalWidth === "number" && typeof data.finalHeight === "number"
          ? `${data.finalWidth}x${data.finalHeight}`
          : `${width}x${height}`;
      const transformedNotice = data.transformed ? " (자동 업스케일 적용)" : "";
      setStatus({
        type: "success",
        message: `업로드 완료: ${data.slug} | 최종 해상도: ${finalSize}${transformedNotice}`,
      });
      setTitle("");
      setSlug("");
      setCaption("");
      setTags("");
      setTakenAt("");
      setTakenAtNone(false);
      setWidth("");
      setHeight("");
      setExif(EMPTY_EXIF);
      setFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setStatus({ type: "error", message });
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-14 pt-10 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-stone-200 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Upload Photo</h1>
            <p className="mt-2 text-sm text-stone-600">
              Supabase Auth 로그인 + 관리자 이메일 allowlist 검증 후 업로드됩니다.
            </p>
          </div>
          <Link
            href="/admin/photos"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            Manage Photos
          </Link>
        </div>
      </header>

      <div className="space-y-5">
        {!hasAuthConfig && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            `NEXT_PUBLIC_SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 설정되지 않아
            로그인할 수 없습니다.
          </p>
        )}

        <section className="space-y-3 rounded-md border border-stone-200 bg-stone-50 p-4">
          {isAuthenticated ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-stone-700">
                로그인됨: <span className="font-medium">{session?.user?.email ?? "unknown user"}</span>
              </p>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-stone-700">
                업로드 전에 GitHub 계정으로 로그인해 주세요.
              </p>
              <button
                type="button"
                onClick={() => void onSignInWithGitHub()}
                className="inline-flex items-center justify-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
                disabled={authStatus.type === "loading" || !hasAuthConfig}
              >
                {authStatus.type === "loading" ? "GitHub 로그인 연결 중..." : "GitHub로 로그인"}
              </button>
              <p className="text-xs text-stone-500">
                로그인 후에도 서버는 `ADMIN_ALLOWED_EMAILS` allowlist에 포함된 이메일만 업로드를 허용합니다.
              </p>
              {authStatus.type === "error" && (
                <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {authStatus.message}
                </p>
              )}
              {authStatus.type === "success" && (
                <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {authStatus.message}
                </p>
              )}
            </div>
          )}
        </section>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Image File</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => file && void requestAiSuggestion(file, aiOverwriteExisting)}
              disabled={!file || aiStatus.type === "loading" || !isAuthenticated}
              className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiStatus.type === "loading" ? "AI 추천 생성 중..." : "AI로 메타데이터 추천"}
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={aiOverwriteExisting}
                onChange={(e) => setAiOverwriteExisting(e.target.checked)}
              />
              기존 값 덮어쓰기
            </label>
          </div>

          {aiStatus.type === "error" && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {aiStatus.message}
            </p>
          )}
          {aiStatus.type === "success" && (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {aiStatus.message}
            </p>
          )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlug((prev) => slugify(prev))}
              placeholder={suggestedSlug || "auto-from-title"}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Taken At</span>
            <input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              disabled={takenAtNone}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
            />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={takenAtNone}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTakenAtNone(checked);
                  if (checked) {
                    setTakenAt("");
                  }
                }}
              />
              Taken At 없음 (none)
            </label>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Width</span>
            <input
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Height</span>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            Tags (comma separated)
          </span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="san-francisco, bridge, sunset"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
          />
        </label>

        <section className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">EXIF (자동 추출 + 수동 편집)</h2>
            <p className="mt-1 text-xs text-stone-600">
              EXIF가 없는 파일(예: 필름 스캔본)은 비워진 상태로 시작하며, 아래에서 직접 입력할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Last Used At</span>
              <input
                type="datetime-local"
                value={exif.lastUsedAt}
                onChange={(e) => setExif((prev) => ({ ...prev, lastUsedAt: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Camera Make</span>
              <input
                value={exif.make}
                onChange={(e) => setExif((prev) => ({ ...prev, make: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Camera Model</span>
              <input
                value={exif.model}
                onChange={(e) => setExif((prev) => ({ ...prev, model: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Focal Length (mm)</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={exif.focalLengthMm}
                onChange={(e) => setExif((prev) => ({ ...prev, focalLengthMm: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Color Space</span>
              <input
                value={exif.colorSpace}
                onChange={(e) => setExif((prev) => ({ ...prev, colorSpace: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Color Profile</span>
              <input
                value={exif.colorProfile}
                onChange={(e) => setExif((prev) => ({ ...prev, colorProfile: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Metering Mode</span>
              <input
                value={exif.meteringMode}
                onChange={(e) => setExif((prev) => ({ ...prev, meteringMode: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Exposure Program</span>
              <input
                value={exif.exposureProgram}
                onChange={(e) => setExif((prev) => ({ ...prev, exposureProgram: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">F Number</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={exif.fNumber}
                onChange={(e) => setExif((prev) => ({ ...prev, fNumber: e.target.value }))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Exposure Time</span>
              <input
                value={exif.exposureTime}
                onChange={(e) => setExif((prev) => ({ ...prev, exposureTime: e.target.value }))}
                placeholder="1/140"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Alpha Channel</span>
              <select
                value={exif.alphaChannel}
                onChange={(e) =>
                  setExif((prev) => ({ ...prev, alphaChannel: e.target.value as BooleanSelect }))
                }
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              >
                <option value="">(empty)</option>
                <option value="true">yes</option>
                <option value="false">no</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Red Eye</span>
              <select
                value={exif.redEye}
                onChange={(e) => setExif((prev) => ({ ...prev, redEye: e.target.value as BooleanSelect }))}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none ring-stone-900 focus:ring"
              >
                <option value="">(empty)</option>
                <option value="true">yes</option>
                <option value="false">no</option>
              </select>
            </label>
          </div>
        </section>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
            disabled={status.type === "loading" || !isAuthenticated}
          >
            {status.type === "loading" ? "Uploading..." : "Upload"}
          </button>

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
        </form>
      </div>
    </main>
  );
}
