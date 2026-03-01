import { describe, expect, it, vi } from "vitest";

const { authorizeAdminRequestMock } = vi.hoisted(() => ({
  authorizeAdminRequestMock: vi.fn(),
}));

vi.mock("@/lib/admin-auth-server", () => ({
  authorizeAdminRequest: authorizeAdminRequestMock,
}));

import { GET } from "@/app/api/admin/session/route";

describe("GET /api/admin/session", () => {
  it("returns isAdmin false for 401/403", async () => {
    authorizeAdminRequestMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await GET(new Request("http://localhost/api/admin/session"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ isAdmin: false });
  });

  it("returns error payload for non-auth failures", async () => {
    authorizeAdminRequestMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: "Missing ADMIN_ALLOWED_EMAILS",
    });

    const response = await GET(new Request("http://localhost/api/admin/session"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Missing ADMIN_ALLOWED_EMAILS" });
  });

  it("returns admin info when authorized", async () => {
    authorizeAdminRequestMock.mockResolvedValue({
      ok: true,
      email: "admin@example.com",
    });

    const response = await GET(new Request("http://localhost/api/admin/session"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      isAdmin: true,
      email: "admin@example.com",
    });
  });
});
