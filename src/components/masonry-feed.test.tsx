// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Photo } from "@/types/photo";
import { makePhoto } from "@/test/fixtures";

vi.mock("@/components/photo-card", () => ({
  PhotoCard: ({ photo }: { photo: Photo }) => <div data-testid="photo-card">{photo.id}</div>,
}));

import { MasonryFeed } from "@/components/masonry-feed";

describe("MasonryFeed", () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      private callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }

      disconnect() {
        // no-op
      }

      unobserve() {
        // no-op
      }

      takeRecords() {
        return [];
      }

      root = null;
      rootMargin = "0px";
      thresholds = [];
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });

  it("loads next page and deduplicates photos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [makePhoto({ id: "p1", slug: "first-shot" }), makePhoto({ id: "p2", slug: "second-shot" })],
          hasMore: false,
          nextCursor: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MasonryFeed
        initialItems={[makePhoto({ id: "p1", slug: "first-shot" })]}
        initialHasMore
        initialNextCursor="first-shot"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("photo-card")).toHaveLength(2);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/photos?limit=15&cursor=first-shot");
    expect(screen.getByText("2 photos")).toBeInTheDocument();
    expect(screen.getByText("모든 사진을 확인했어요.")).toBeInTheDocument();
  });

  it("shows retry button when fetch fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [makePhoto({ id: "p2", slug: "second" })],
            hasMore: false,
            nextCursor: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MasonryFeed
        initialItems={[makePhoto({ id: "p1", slug: "first" })]}
        initialHasMore
        initialNextCursor="first"
      />
    );

    const retryButton = await screen.findByRole("button", { name: "다시 시도" });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getAllByTestId("photo-card")).toHaveLength(2);
    });
  });
});
