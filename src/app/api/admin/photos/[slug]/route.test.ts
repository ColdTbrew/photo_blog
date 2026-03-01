import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeAdminRequestMock,
  createServiceRoleClientMock,
  invalidatePhotosCacheMock,
  patchSingleMock,
  patchSelectMock,
  patchEqMock,
  patchUpdateMock,
  findSingleMock,
  findEqMock,
  findSelectMock,
  deleteEqMock,
  deleteDeleteMock,
  storageRemoveMock,
  storageFromMock,
  fromMock,
} = vi.hoisted(() => {
  const authorizeAdminRequestMock = vi.fn();
  const createServiceRoleClientMock = vi.fn();
  const invalidatePhotosCacheMock = vi.fn();

  const patchSingleMock = vi.fn();
  const patchSelectMock = vi.fn(() => ({ single: patchSingleMock }));
  const patchEqMock = vi.fn(() => ({ select: patchSelectMock }));
  const patchUpdateMock = vi.fn(() => ({ eq: patchEqMock }));

  const findSingleMock = vi.fn();
  const findEqMock = vi.fn(() => ({ single: findSingleMock }));
  const findSelectMock = vi.fn(() => ({ eq: findEqMock }));

  const deleteEqMock = vi.fn();
  const deleteDeleteMock = vi.fn(() => ({ eq: deleteEqMock }));

  const storageRemoveMock = vi.fn();
  const storageFromMock = vi.fn(() => ({ remove: storageRemoveMock }));

  const fromMock = vi.fn(() => ({
    update: patchUpdateMock,
    select: findSelectMock,
    delete: deleteDeleteMock,
  }));

  return {
    authorizeAdminRequestMock,
    createServiceRoleClientMock,
    invalidatePhotosCacheMock,
    patchSingleMock,
    patchSelectMock,
    patchEqMock,
    patchUpdateMock,
    findSingleMock,
    findEqMock,
    findSelectMock,
    deleteEqMock,
    deleteDeleteMock,
    storageRemoveMock,
    storageFromMock,
    fromMock,
  };
});

vi.mock("@/lib/admin-auth-server", () => ({
  authorizeAdminRequest: authorizeAdminRequestMock,
  createServiceRoleClient: createServiceRoleClientMock,
}));

vi.mock("@/lib/photos", () => ({
  invalidatePhotosCache: invalidatePhotosCacheMock,
}));

import { DELETE, PATCH } from "@/app/api/admin/photos/[slug]/route";

function makeContext(slug = "first-shot") {
  return { params: Promise.resolve({ slug }) };
}

describe("/api/admin/photos/[slug]", () => {
  beforeEach(() => {
    authorizeAdminRequestMock.mockReset();
    createServiceRoleClientMock.mockReset();
    invalidatePhotosCacheMock.mockReset();

    patchSingleMock.mockReset();
    patchSelectMock.mockClear();
    patchEqMock.mockClear();
    patchUpdateMock.mockClear();

    findSingleMock.mockReset();
    findSelectMock.mockClear();
    findEqMock.mockClear();

    deleteEqMock.mockReset();
    deleteDeleteMock.mockClear();

    storageRemoveMock.mockReset();
    storageFromMock.mockClear();
    fromMock.mockClear();

    authorizeAdminRequestMock.mockResolvedValue({ ok: true, email: "admin@example.com" });
    createServiceRoleClientMock.mockReturnValue({
      from: fromMock,
      storage: {
        from: storageFromMock,
      },
    });
  });

  it("PATCH returns 400 when title or caption is empty", async () => {
    const request = new Request("http://localhost/api/admin/photos/first-shot", {
      method: "PATCH",
      body: JSON.stringify({ title: "", caption: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, makeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "title and caption are required" });
  });

  it("PATCH updates metadata and returns normalized response", async () => {
    patchSingleMock.mockResolvedValue({
      error: null,
      data: {
        id: "p1",
        slug: "new-slug",
        src: "https://example.com/p.webp",
        width: 3200,
        height: 2400,
        title: "New title",
        caption: "New caption",
        tags: ["night", "city"],
        taken_at: "2026-01-10",
        created_at: "2026-01-11T00:00:00.000Z",
        exif_make: "FUJI",
        exif_model: "X-T5",
        exif_lens_model: "23mm",
        exif_iso: 160,
        exif_focal_length_mm: 23,
        exif_f_number: 2,
        exif_exposure_time: "1/125s",
      },
    });

    const request = new Request("http://localhost/api/admin/photos/first-shot", {
      method: "PATCH",
      body: JSON.stringify({
        title: " New title ",
        caption: " New caption ",
        tags: "night, city",
        takenAt: "2026-01-10",
        slug: " New Slug ",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, makeContext("first-shot"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(patchUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New title",
        caption: "New caption",
        tags: ["night", "city"],
        slug: "new-slug",
        taken_at: "2026-01-10",
      })
    );
    expect(body).toMatchObject({
      ok: true,
      slug: "new-slug",
      photo: {
        id: "p1",
        title: "New title",
        caption: "New caption",
      },
    });
    expect(invalidatePhotosCacheMock).toHaveBeenCalledTimes(1);
  });

  it("DELETE returns 404 when photo is missing", async () => {
    findSingleMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    });

    const response = await DELETE(
      new Request("http://localhost/api/admin/photos/missing", { method: "DELETE" }),
      makeContext("missing")
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Photo not found" });
  });

  it("DELETE removes row and reports storage warning without failing", async () => {
    findSingleMock.mockResolvedValue({
      data: { id: "p1", slug: "first-shot", storage_path: "first.webp" },
      error: null,
    });
    deleteEqMock.mockResolvedValue({ error: null });
    storageRemoveMock.mockResolvedValue({ error: { message: "storage remove failed" } });

    const response = await DELETE(
      new Request("http://localhost/api/admin/photos/first-shot", { method: "DELETE" }),
      makeContext("first-shot")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deletedSlug: "first-shot",
      partialWarning: "storage remove failed",
    });
    expect(storageFromMock).toHaveBeenCalledWith("photos");
    expect(invalidatePhotosCacheMock).toHaveBeenCalledTimes(1);
  });
});
