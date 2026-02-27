"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function HomeNavDrawer() {
  const [open, setOpen] = useState(false);
  const canUseDom = typeof window !== "undefined";

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        aria-controls="home-drawer"
        onClick={() => setOpen(true)}
        className="relative z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white/90 text-stone-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </button>

      {canUseDom &&
        createPortal(
          <div
            className={`fixed inset-0 z-[100] transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            aria-hidden={!open}
          >
            <button
              type="button"
              aria-label="메뉴 닫기"
              className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <aside
              id="home-drawer"
              className={`absolute inset-y-0 left-0 w-80 max-w-[88vw] border-r border-stone-200/70 bg-stone-50 p-6 shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
            >
              <div className="mb-8 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] font-semibold text-stone-400">Menu</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight text-stone-800">Navigation</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-600 shadow-sm transition hover:bg-stone-100"
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4.5 w-4.5 fill-none stroke-current" strokeWidth="2">
                    <path d="M6 6l12 12" />
                    <path d="M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <nav className="space-y-3">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="group block rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <p className="text-xs uppercase tracking-[0.16em] font-semibold text-stone-400">Home</p>
                  <p className="mt-1 text-base font-bold text-stone-800">Feed</p>
                </Link>
                <Link
                  href="/graph"
                  onClick={() => setOpen(false)}
                  className="group block rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <p className="text-xs uppercase tracking-[0.16em] font-semibold text-stone-400">Explore</p>
                  <p className="mt-1 text-base font-bold text-stone-800">Graph View</p>
                </Link>
              </nav>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
