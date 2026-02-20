"use client";

import Link from "next/link";
import { useAdminSession } from "@/lib/admin-auth-client";

export function AdminAuthActions() {
  const {
    hasAuthConfig,
    isAuthenticated,
    isAdmin,
    authStatus,
    authError,
    signInWithGitHub,
    signOut,
  } = useAdminSession();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!isAuthenticated && (
        <button
          type="button"
          onClick={() => void signInWithGitHub("/")}
          disabled={!hasAuthConfig || authStatus === "loading"}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {authStatus === "loading" ? "로그인 연결 중..." : "GitHub 로그인"}
        </button>
      )}

      {isAuthenticated && isAdmin && (
        <>
          <Link
            href="/admin/upload"
            className="rounded-full border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold !text-white shadow-sm transition hover:bg-stone-700"
          >
            Upload
          </Link>
          <Link
            href="/admin/photos"
            className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            Manage
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
          >
            로그아웃
          </button>
        </>
      )}

      {isAuthenticated && !isAdmin && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
        >
          로그아웃
        </button>
      )}

      {authError && <p className="w-full text-right text-xs text-red-600">{authError}</p>}
    </div>
  );
}
