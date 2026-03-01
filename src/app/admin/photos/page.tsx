"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "@/lib/admin-auth-client";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string };

type AdminPhotoListItem = {
  id: string;
  slug: string;
  title: string;
  takenAt: string | null;
};

async function parseJsonSafely(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function AdminPhotosPage() {
  const { isAuthenticated, isAdmin, session, signInWithGitHub, signOut } = useAdminSession();
  const [items, setItems] = useState<AdminPhotoListItem[]>([]);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const load = useCallback(async () => {
    if (!session?.access_token) {
      return;
    }

    setStatus({ type: "loading" });
    try {
      const response = await fetch("/api/admin/photos?limit=300", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await parseJsonSafely(response);
      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : `목록을 불러오지 못했습니다. (HTTP ${response.status})`;
        throw new Error(message);
      }

      const itemsRaw = Array.isArray(data?.items) ? data.items : [];
      const normalized = itemsRaw
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const row = item as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id : "";
          const slug = typeof row.slug === "string" ? row.slug : "";
          const title = typeof row.title === "string" ? row.title : "";
          const takenAt = typeof row.takenAt === "string" ? row.takenAt : null;

          if (!id || !slug || !title) {
            return null;
          }
          return { id, slug, title, takenAt };
        })
        .filter((item): item is AdminPhotoListItem => Boolean(item));

      setItems(normalized);
      setStatus({ type: "idle" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setStatus({ type: "error", message });
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-14 pt-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Manage Photos</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            aria-label="홈으로 이동"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M6.5 9.5V21h11V9.5" />
            </svg>
          </Link>
          <Link
            href="/admin/upload"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            Upload
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            로그아웃
          </button>
        </div>
      </header>

      {!isAuthenticated && (
        <section className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm text-stone-700">관리자 로그인이 필요합니다.</p>
          <button
            type="button"
            onClick={() => void signInWithGitHub("/admin/photos")}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white"
          >
            GitHub로 로그인
          </button>
        </section>
      )}

      {isAuthenticated && !isAdmin && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          관리자 권한이 없어 접근할 수 없습니다.
        </p>
      )}

      {isAuthenticated && isAdmin && (
        <section className="space-y-4">
          {status.type === "loading" && <p className="text-sm text-stone-500">목록을 불러오는 중...</p>}
          {status.type === "error" && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {status.message}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-stone-50 text-left text-stone-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Slug</th>
                  <th className="px-3 py-2 font-medium">Taken At</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-stone-200">
                    <td className="px-3 py-2 text-stone-900">{item.title}</td>
                    <td className="px-3 py-2 text-stone-600">{item.slug}</td>
                    <td className="px-3 py-2 text-stone-600">{item.takenAt ?? "-"}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/photo/${item.slug}`}
                        className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                      >
                        상세/수정
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
