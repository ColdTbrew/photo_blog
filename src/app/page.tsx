import { AdminAuthActions } from "@/components/admin-auth-actions";
import { HomeNavDrawer } from "@/components/home-nav-drawer";
import { MasonryFeed } from "@/components/masonry-feed";
import { getPhotosPage } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialPage = await getPhotosPage({ limit: 15 });

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">
      <header className="mb-12 border-b border-stone-200/60 pb-8 animate-fade-in-up">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <HomeNavDrawer />
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">
                Lightlog
              </p>
            </div>
            <h1 className="text-4xl font-semibold tracking-tighter text-stone-900 sm:text-5xl lg:text-6xl">
              Lightlog <span className="text-stone-400 font-light italic">by</span> Coldbrew
            </h1>
            <p className="max-w-xl text-base font-medium leading-relaxed text-stone-500 sm:text-lg">
              사진들로 기억을 남긴 갤러리입니다.
            </p>
          </div>

          <div className="pb-1 sm:pb-2">
            <AdminAuthActions />
          </div>
        </div>
      </header>

      <div className="animate-fade-in-up delay-300">
        <MasonryFeed
          initialItems={initialPage.items}
          initialHasMore={initialPage.hasMore}
          initialNextCursor={initialPage.nextCursor}
        />
      </div>
    </main>
  );
}
