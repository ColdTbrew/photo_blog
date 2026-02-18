import { MasonryFeed } from "@/components/masonry-feed";
import { getPhotosPage } from "@/lib/photos";

export default async function Home() {
  const initialPage = await getPhotosPage({ limit: 15 });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <header className="mb-10 border-b border-stone-200 pb-6">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Photo Blog</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Scroll Through Moments
        </h1>
        <p className="mt-3 max-w-2xl text-base text-stone-600">
          아래로 스크롤할수록 내가 찍은 사진들이 자연스럽게 이어지는 개인 갤러리입니다.
        </p>
      </header>

      <MasonryFeed
        initialItems={initialPage.items}
        initialHasMore={initialPage.hasMore}
        initialNextCursor={initialPage.nextCursor}
      />
    </main>
  );
}
