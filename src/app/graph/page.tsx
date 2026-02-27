import Link from "next/link";
import { PhotoGraphView } from "@/components/photo-graph-view";

export default function GraphPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Graph View</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Tag Network
          </h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
        >
          ← Back to feed
        </Link>
      </header>

      <PhotoGraphView />
    </main>
  );
}
