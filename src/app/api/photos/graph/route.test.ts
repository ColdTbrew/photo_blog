import { describe, expect, it, vi } from "vitest";
import { makePhoto } from "@/test/fixtures";

const { getAllPhotosMock } = vi.hoisted(() => ({
  getAllPhotosMock: vi.fn(),
}));

vi.mock("@/lib/photos", () => ({
  getAllPhotos: getAllPhotosMock,
}));

import { GET } from "@/app/api/photos/graph/route";

describe("GET /api/photos/graph", () => {
  it("builds graph with top tags and photo-tag links", async () => {
    getAllPhotosMock.mockResolvedValue([
      makePhoto({ id: "p1", slug: "one", tags: ["seoul", " night ", ""] }),
      makePhoto({ id: "p2", slug: "two", tags: ["seoul", "street"] }),
    ]);

    const response = await GET(new Request("http://localhost/api/photos/graph?minTagFreq=2"));
    const body = (await response.json()) as {
      nodes: Array<{ id: string; type: string }>;
      links: Array<{ source: string; target: string }>;
      meta: { minTagFreq: number; totalPhotos: number; totalTags: number };
    };

    expect(response.status).toBe(200);
    expect(body.meta).toMatchObject({ minTagFreq: 2, totalPhotos: 2, totalTags: 3 });

    const tagIds = body.nodes.filter((n) => n.type === "tag").map((n) => n.id);
    expect(tagIds).toEqual(["tag:seoul"]);

    const photoIds = body.nodes.filter((n) => n.type === "photo").map((n) => n.id);
    expect(photoIds).toEqual(["photo:p1", "photo:p2"]);

    expect(body.links).toEqual([
      { source: "photo:p1", target: "tag:seoul", weight: 1 },
      { source: "photo:p2", target: "tag:seoul", weight: 1 },
    ]);
  });

  it("uses default minTagFreq when query is invalid", async () => {
    getAllPhotosMock.mockResolvedValue([makePhoto({ id: "p1", tags: ["a", "b"] })]);

    const response = await GET(new Request("http://localhost/api/photos/graph?minTagFreq=abc"));
    const body = (await response.json()) as { meta: { minTagFreq: number } };

    expect(body.meta.minTagFreq).toBe(1);
  });
});
