import { describe, expect, it, vi } from "vitest";

const { getPhotosPageMock } = vi.hoisted(() => ({
  getPhotosPageMock: vi.fn(),
}));

vi.mock("@/lib/photos", () => ({
  getPhotosPage: getPhotosPageMock,
}));

import { GET } from "@/app/api/photos/route";

describe("GET /api/photos", () => {
  it("passes cursor and limit to getPhotosPage", async () => {
    getPhotosPageMock.mockResolvedValue({
      items: [{ id: "p1", slug: "a" }],
      hasMore: true,
      nextCursor: "a",
    });

    const request = new Request("http://localhost/api/photos?cursor=a&limit=10");
    const response = await GET(request);

    expect(getPhotosPageMock).toHaveBeenCalledWith({ cursor: "a", limit: 10 });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: "p1", slug: "a" }],
      hasMore: true,
      nextCursor: "a",
    });
  });

  it("forwards undefined limit when query value is missing", async () => {
    getPhotosPageMock.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });

    const request = new Request("http://localhost/api/photos");
    await GET(request);

    expect(getPhotosPageMock).toHaveBeenCalledWith({ cursor: undefined, limit: undefined });
  });
});
