import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryState, queryBuilder, fromMock, createClientMock } = vi.hoisted(() => {
  const queryState: {
    data: unknown[] | null;
    error: { message: string } | null;
  } = {
    data: [],
    error: null,
  };

  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then(
      onFulfilled: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown
    ) {
      return Promise.resolve(onFulfilled({ data: queryState.data, error: queryState.error }));
    },
  };

  const fromMock = vi.fn(() => queryBuilder);
  const createClientMock = vi.fn(() => ({ from: fromMock }));

  return { queryState, queryBuilder, fromMock, createClientMock };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { getAllPhotos, getPhotoBySlug, getPhotosPage } from "@/lib/photos";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    slug: "first-shot",
    src: "https://example.com/first.webp",
    storage_path: "first.webp",
    width: 3200,
    height: 2400,
    title: "First Shot",
    caption: "A quiet morning",
    tags: ["seoul", "street"],
    taken_at: "2026-01-10",
    created_at: "2026-01-11T00:00:00.000Z",
    exif_make: "FUJIFILM",
    exif_model: "X-T5",
    exif_lens_model: "XF23mm",
    exif_iso: 160,
    exif_focal_length_mm: 23,
    exif_f_number: 2,
    exif_exposure_time: "1/125s",
    ...overrides,
  };
}

describe("photos library", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
    queryState.data = [];
    queryState.error = null;
    fromMock.mockClear();
    createClientMock.mockClear();
    queryBuilder.select.mockClear();
    queryBuilder.order.mockClear();
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("throws when supabase read env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    await expect(getAllPhotos()).rejects.toThrow(
      "Supabase read env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  });

  it("maps rows to photo model and warns on duplicate slugs", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    queryState.data = [
      makeRow(),
      makeRow({ id: "p2", slug: "first-shot", src: "https://example.com/second.webp" }),
    ];

    const photos = await getAllPhotos();

    expect(photos).toHaveLength(2);
    expect(photos[0]).toMatchObject({
      id: "p1",
      slug: "first-shot",
      takenAt: "2026-01-10",
      createdAt: "2026-01-11T00:00:00.000Z",
      exifMake: "FUJIFILM",
    });
    expect(warnSpy).toHaveBeenCalledWith("[photos] duplicate slug detected: first-shot");
    expect(createClientMock).toHaveBeenCalledWith("https://db.example.co", "pk_test", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(fromMock).toHaveBeenCalledWith("photos");
  });

  it("returns null when photo slug does not exist", async () => {
    queryState.data = [makeRow({ slug: "alpha" }), makeRow({ id: "p2", slug: "beta" })];

    await expect(getPhotoBySlug("missing")).resolves.toBeNull();
    await expect(getPhotoBySlug("beta")).resolves.toMatchObject({ id: "p2", slug: "beta" });
  });

  it("paginates by cursor and clamps limit", async () => {
    queryState.data = [
      makeRow({ id: "p1", slug: "a" }),
      makeRow({ id: "p2", slug: "b" }),
      makeRow({ id: "p3", slug: "c" }),
      makeRow({ id: "p4", slug: "d" }),
    ];

    const first = await getPhotosPage({ limit: 2 });
    expect(first.items.map((item) => item.slug)).toEqual(["a", "b"]);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBe("b");

    const second = await getPhotosPage({ cursor: "b", limit: 999 });
    expect(second.items.map((item) => item.slug)).toEqual(["c", "d"]);
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it("throws when supabase query returns an error", async () => {
    queryState.error = { message: "database down" };

    await expect(getAllPhotos()).rejects.toThrow("database down");
  });
});
