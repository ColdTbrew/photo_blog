import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, createClientMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const createClientMock = vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  }));

  return { getUserMock, createClientMock };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { authorizeAdminRequest, createServiceRoleClient } from "@/lib/admin-auth-server";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin", {
    headers,
  });
}

describe("admin-auth-server", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
    process.env.ADMIN_ALLOWED_EMAILS = "admin@example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_test";

    getUserMock.mockReset();
    createClientMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("allows legacy token auth when enabled", async () => {
    process.env.ADMIN_UPLOAD_LEGACY_TOKEN_ENABLED = "true";
    process.env.ADMIN_UPLOAD_TOKEN = "legacy-secret";

    const formData = new FormData();
    formData.set("token", "legacy-secret");

    const result = await authorizeAdminRequest(makeRequest(), {
      allowLegacyToken: true,
      formData,
    });

    expect(result).toEqual({ ok: true, email: "legacy-token" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 500 when publishable key is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const result = await authorizeAdminRequest(makeRequest());

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for admin auth",
    });
  });

  it("returns 401 when bearer token is missing", async () => {
    const result = await authorizeAdminRequest(makeRequest());

    expect(result).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("returns 403 when authenticated user is not in allowed emails", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "not-admin@example.com" } },
      error: null,
    });

    const result = await authorizeAdminRequest(
      makeRequest({ authorization: "Bearer access_token" })
    );

    expect(result).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("returns ok for allowed email and normalizes case", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = "ADMIN@EXAMPLE.COM, another@example.com";
    getUserMock.mockResolvedValue({
      data: { user: { email: "Admin@Example.com" } },
      error: null,
    });

    const result = await authorizeAdminRequest(
      makeRequest({ authorization: "Bearer access_token" })
    );

    expect(result).toEqual({ ok: true, email: "admin@example.com" });
  });

  it("creates service-role client with required credentials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public-url.supabase.co";

    createServiceRoleClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://public-url.supabase.co",
      "service_test",
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  });
});
