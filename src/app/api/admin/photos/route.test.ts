import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureMinimumResolutionMock,
  invalidatePhotosCacheMock,
  authorizeAdminRequestMock,
  createServiceRoleClientMock,
  selectBuilder,
  selectMock,
  insertMock,
  fromMock,
  uploadMock,
  getPublicUrlMock,
  storageFromMock,
  listState,
} = vi.hoisted(() => {
  const ensureMinimumResolutionMock = vi.fn();
  const invalidatePhotosCacheMock = vi.fn();
  const authorizeAdminRequestMock = vi.fn();
  const createServiceRoleClientMock = vi.fn();

  const listState: {
    data: unknown[] | null;
    error: { message: string } | null;
  } = {
    data: [],
    error: null,
  };

  const selectBuilder = {
    order: vi.fn().mockReturnThis(),
    then(
      onFulfilled: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown
    ) {
      return Promise.resolve(onFulfilled({ data: listState.data, error: listState.error }));
    },
  };

  const selectMock = vi.fn(() => selectBuilder);
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({
    select: selectMock,
    insert: insertMock,
  }));

  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn(() => ({
    data: { publicUrl: "https://project.supabase.co/storage/v1/object/public/photos/seoul.webp" },
  }));
  const storageFromMock = vi.fn(() => ({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  }));

  return {
    ensureMinimumResolutionMock,
    invalidatePhotosCacheMock,
    authorizeAdminRequestMock,
    createServiceRoleClientMock,
    selectBuilder,
    selectMock,
    insertMock,
    fromMock,
    uploadMock,
    getPublicUrlMock,
    storageFromMock,
    listState,
  };
});

vi.mock("@/lib/image-resolution", () => ({
  WEBP_QUALITY_UPLOAD: 80,
  ensureMinimumResolution: ensureMinimumResolutionMock,
}));

vi.mock("@/lib/photos", () => ({
  invalidatePhotosCache: invalidatePhotosCacheMock,
}));

vi.mock("@/lib/admin-auth-server", () => ({
  authorizeAdminRequest: authorizeAdminRequestMock,
  createServiceRoleClient: createServiceRoleClientMock,
}));

import { GET, POST } from "@/app/api/admin/photos/route";

describe("/api/admin/photos", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES = "10000000";

    ensureMinimumResolutionMock.mockReset();
    invalidatePhotosCacheMock.mockReset();
    authorizeAdminRequestMock.mockReset();
    createServiceRoleClientMock.mockReset();

    selectBuilder.order.mockClear();
    selectMock.mockClear();
    insertMock.mockReset();
    fromMock.mockClear();

    uploadMock.mockReset();
    getPublicUrlMock.mockClear();
    storageFromMock.mockClear();

    listState.data = [];
    listState.error = null;

    authorizeAdminRequestMock.mockResolvedValue({ ok: true, email: "admin@example.com" });
    createServiceRoleClientMock.mockReturnValue({
      from: fromMock,
      storage: {
        from: storageFromMock,
      },
    });

    uploadMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("GET returns auth error when unauthorized", async () => {
    authorizeAdminRequestMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Forbidden",
    });

    const response = await GET(new Request("http://localhost/api/admin/photos"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("GET lists mapped photos when authorized", async () => {
    listState.data = [
      {
        id: "p1",
        slug: "first-shot",
        src: "https://example.com/first.webp",
        width: 3200,
        height: 2400,
        title: "First",
        caption: "Caption",
        tags: ["street"],
        taken_at: "2026-01-10",
        created_at: "2026-01-11T00:00:00.000Z",
        exif_make: "FUJI",
        exif_model: "X-T5",
        exif_lens_model: null,
        exif_iso: 160,
        exif_focal_length_mm: 23,
        exif_f_number: 2,
        exif_exposure_time: "1/125s",
      },
    ];

    const response = await GET(new Request("http://localhost/api/admin/photos"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: [
        {
          id: "p1",
          slug: "first-shot",
          src: "https://example.com/first.webp",
          width: 3200,
          height: 2400,
          title: "First",
          caption: "Caption",
          tags: ["street"],
          takenAt: "2026-01-10",
          createdAt: "2026-01-11T00:00:00.000Z",
          exifMake: "FUJI",
          exifModel: "X-T5",
          exifLensModel: null,
          exifIso: 160,
          exifFocalLengthMm: 23,
          exifFNumber: 2,
          exifExposureTime: "1/125s",
        },
      ],
    });
  });

  it("POST validates missing file", async () => {
    const formData = new FormData();
    formData.set("title", "Title");
    formData.set("caption", "Caption");

    const response = await POST(
      new Request("http://localhost/api/admin/photos", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "file is required" });
  });

  it("POST rejects unsupported file type", async () => {
    const formData = new FormData();
    formData.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
    formData.set("title", "Title");
    formData.set("caption", "Caption");
    formData.set("width", "100");
    formData.set("height", "100");

    const response = await POST(
      new Request("http://localhost/api/admin/photos", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "unsupported file type" });
  });

  it("POST uploads transformed image and inserts photo row", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-aaaa-bbbb-cccc-1234567890ab");

    ensureMinimumResolutionMock.mockResolvedValue({
      data: Buffer.from([9, 8, 7]),
      width: 2000,
      height: 3000,
      upscaled: true,
      normalized: {
        shortSide: 1000,
        longSide: 1500,
        scale: 2,
        targetWidth: 2000,
        targetHeight: 3000,
        shouldUpscale: true,
      },
    });

    const formData = new FormData();
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "source.jpg", { type: "image/jpeg" }));
    formData.set("slug", " Seoul Night ");
    formData.set("title", "서울 야경");
    formData.set("caption", "강변의 밤");
    formData.set("tags", "night, seoul");
    formData.set("width", "1000");
    formData.set("height", "1500");
    formData.set("takenAt", "2026-02-01");

    const response = await POST(
      new Request("http://localhost/api/admin/photos", {
        method: "POST",
        body: formData,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadMock).toHaveBeenCalledWith(
      "seoul-night-1700000000000.webp",
      Buffer.from([9, 8, 7]),
      expect.objectContaining({
        contentType: "image/webp",
        upsert: false,
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "p_12345678",
        slug: "seoul-night",
        width: 2000,
        height: 3000,
        title: "서울 야경",
        caption: "강변의 밤",
        tags: ["night", "seoul"],
      })
    );
    expect(body).toMatchObject({
      ok: true,
      id: "p_12345678",
      slug: "seoul-night",
      transformed: true,
      finalWidth: 2000,
      finalHeight: 3000,
    });
    expect(invalidatePhotosCacheMock).toHaveBeenCalledTimes(1);
  });
});
