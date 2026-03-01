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

import { POST } from "@/app/api/admin/photos/ai-suggest/route";

describe("POST /api/admin/photos/ai-suggest", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
    process.env.ADMIN_ALLOWED_EMAILS = "admin@example.com";
    process.env.OPENAI_API_KEY = "sk-test";

    getUserMock.mockReset();
    createClientMock.mockClear();

    getUserMock.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
      error: null,
    });
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("returns 401 when bearer token is missing", async () => {
    const formData = new FormData();
    formData.set("file", new File([new Uint8Array([1, 2])], "a.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/admin/photos/ai-suggest", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when file is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/photos/ai-suggest", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: new FormData(),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "file is required" });
  });

  it("returns 400 when file is not an image", async () => {
    const formData = new FormData();
    formData.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));

    const response = await POST(
      new Request("http://localhost/api/admin/photos/ai-suggest", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "file must be an image" });
  });

  it("returns sanitized AI suggestion payload", async () => {
    const apiPayload = {
      output_text: JSON.stringify({
        title: "  서울 의 밤   산책  ",
        slug: "Seoul Night!!!",
        caption: "   한강 따라 걷던 고요한 밤   ",
        tags: ["Night", "night", "City View", "  "],
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(apiPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const formData = new FormData();
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/admin/photos/ai-suggest", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "서울 의 밤 산책",
      slug: "seoul-night",
      caption: "한강 따라 걷던 고요한 밤",
      tags: ["night", "city-view"],
    });
  });

  it("retries same model on incomplete reasoning-only response and succeeds", async () => {
    process.env.OPENAI_VISION_MODEL = "gpt-5-nano";

    const requestedModels: string[] = [];
    const fetchMock = vi.fn().mockImplementation((_url: string | URL | Request, init?: RequestInit) => {
      const bodyText = typeof init?.body === "string" ? init.body : "";
      const body = bodyText ? (JSON.parse(bodyText) as { model?: string }) : {};
      const model = body.model ?? "";
      requestedModels.push(model);

      if (fetchMock.mock.calls.length === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: "incomplete",
              incomplete_details: { reason: "max_output_tokens" },
              output: [{ type: "reasoning" }],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              title: "서울 밤 산책",
              slug: "seoul-night-walk",
              caption: "가로등 아래 고요한 골목을 걸었다.",
              tags: ["seoul", "night-walk", "street"],
            }),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const formData = new FormData();
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/admin/photos/ai-suggest", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "서울 밤 산책",
      slug: "seoul-night-walk",
      caption: "가로등 아래 고요한 골목을 걸었다.",
      tags: ["seoul", "night-walk", "street"],
    });
    expect(requestedModels).toEqual(["gpt-5-nano", "gpt-5-nano"]);
  });
});
