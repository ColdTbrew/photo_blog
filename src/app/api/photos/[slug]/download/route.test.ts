import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePhoto } from "@/test/fixtures";

const { getPhotoBySlugMock, ensureMinimumResolutionMock } = vi.hoisted(() => ({
  getPhotoBySlugMock: vi.fn(),
  ensureMinimumResolutionMock: vi.fn(),
}));

vi.mock("@/lib/photos", () => ({
  getPhotoBySlug: getPhotoBySlugMock,
}));

vi.mock("@/lib/image-resolution", () => ({
  AVIF_QUALITY_DOWNLOAD: 62,
  ensureMinimumResolution: ensureMinimumResolutionMock,
}));

import { GET } from "@/app/api/photos/[slug]/download/route";

describe("GET /api/photos/[slug]/download", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    getPhotoBySlugMock.mockReset();
    ensureMinimumResolutionMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("returns 404 when photo does not exist", async () => {
    getPhotoBySlugMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/photos/missing/download"), {
      params: Promise.resolve({ slug: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Photo not found" });
  });

  it("returns 502 for untrusted source URL", async () => {
    getPhotoBySlugMock.mockResolvedValue(
      makePhoto({ src: "https://evil.example.com/storage/v1/object/public/photos/hack.webp" })
    );

    const response = await GET(new Request("http://localhost/api/photos/one/download"), {
      params: Promise.resolve({ slug: "one" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Untrusted photo source" });
  });

  it("returns timeout error when upstream fetch aborts", async () => {
    getPhotoBySlugMock.mockResolvedValue(
      makePhoto({ src: "https://project.supabase.co/storage/v1/object/public/photos/one.webp" })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Timed out", "AbortError"))
    );

    const response = await GET(new Request("http://localhost/api/photos/one/download"), {
      params: Promise.resolve({ slug: "one" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Image download timed out" });
  });

  it("returns transformed avif file for trusted source", async () => {
    const photo = makePhoto({
      slug: "my cool/photo",
      src: "https://project.supabase.co/storage/v1/object/public/photos/my-photo.webp",
    });
    getPhotoBySlugMock.mockResolvedValue(photo);

    const upstreamBytes = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(upstreamBytes, {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        })
      )
    );

    ensureMinimumResolutionMock.mockResolvedValue({
      data: Buffer.from([9, 8, 7]),
      width: 2000,
      height: 3000,
      upscaled: true,
      normalized: {
        shortSide: 2000,
        longSide: 3000,
        scale: 1,
        targetWidth: 2000,
        targetHeight: 3000,
        shouldUpscale: false,
      },
    });

    const response = await GET(new Request("http://localhost/api/photos/one/download"), {
      params: Promise.resolve({ slug: "one" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/avif");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="my-cool-photo.avif"'
    );

    expect(ensureMinimumResolutionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 62,
        outputFormat: "avif",
        enforceMinimum: true,
        fallbackWidth: photo.width,
        fallbackHeight: photo.height,
      })
    );

    const body = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(body)).toEqual([9, 8, 7]);
  });
});
