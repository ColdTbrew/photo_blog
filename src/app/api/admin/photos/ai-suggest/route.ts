import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

type AiSuggestion = {
  title: string;
  slug: string;
  caption: string;
  tags: string[];
};

type OpenAiErrorPayload = {
  status: number;
  message: string;
  type: string;
  code: string;
  param: string;
  requestId: string;
  model: string;
};

class OpenAiRequestError extends Error {
  status: number;
  payload: OpenAiErrorPayload;

  constructor(payload: OpenAiErrorPayload) {
    super(payload.message);
    this.status = payload.status;
    this.payload = payload;
  }
}

type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string };

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name];
  return value ? value : null;
}

function parseAllowedEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  const value = token.trim();
  return value ? value : null;
}

async function authorizeAdminRequest(request: Request): Promise<AdminAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getRequiredEnv("SUPABASE_URL");
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null;
  const allowedEmailsRaw = getOptionalEnv("ADMIN_ALLOWED_EMAILS");

  if (!publishableKey) {
    return {
      ok: false,
      status: 500,
      error: "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for admin auth",
    };
  }

  if (!allowedEmailsRaw) {
    return {
      ok: false,
      status: 500,
      error: "Missing ADMIN_ALLOWED_EMAILS for admin auth",
    };
  }

  const allowedEmails = parseAllowedEmails(allowedEmailsRaw);
  if (allowedEmails.size === 0) {
    return {
      ok: false,
      status: 500,
      error: "ADMIN_ALLOWED_EMAILS is empty",
    };
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const email = data.user.email.toLowerCase();
  if (!allowedEmails.has(email)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
    };
  }

  return { ok: true, email };
}

function getSuggestionModel(): string {
  const value = process.env.OPENAI_VISION_MODEL?.trim();
  return value || DEFAULT_MODEL;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeTitle(value: unknown): string {
  const normalized = safeString(value).replace(/\s+/g, " ");
  return normalized.slice(0, 120);
}

function sanitizeCaption(value: unknown): string {
  const normalized = safeString(value).replace(/\s+/g, " ");
  return normalized.slice(0, 220);
}

function sanitizeSlug(value: unknown): string {
  return safeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedup = new Set<string>();
  for (const item of value) {
    const tag = safeString(item)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!tag) continue;
    if (tag.length > 32) continue;
    dedup.add(tag);
    if (dedup.size >= 12) break;
  }

  return [...dedup];
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty LLM output");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const target = fencedMatch ? fencedMatch[1].trim() : trimmed;
  try {
    return JSON.parse(target);
  } catch {
    const snippet = target.slice(0, 240).replace(/\s+/g, " ");
    throw new Error(`Model did not return valid JSON. Raw snippet: ${snippet}`);
  }
}

function parseSuggestion(raw: unknown): AiSuggestion {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid suggestion shape");
  }

  const obj = raw as Record<string, unknown>;
  const title = sanitizeTitle(obj.title);
  const slug = sanitizeSlug(obj.slug);
  const caption = sanitizeCaption(obj.caption);
  const tags = sanitizeTags(obj.tags);

  if (!title) {
    throw new Error("Suggestion missing title");
  }
  if (!slug) {
    throw new Error("Suggestion missing slug");
  }
  if (!caption) {
    throw new Error("Suggestion missing caption");
  }

  return { title, slug, caption, tags };
}

function readOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  const refusals: string[] = [];
  const outputTypes: string[] = [];
  const contentTypes: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemType = safeString((item as Record<string, unknown>).type);
    if (itemType) {
      outputTypes.push(itemType);
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      const contentType = safeString((c as Record<string, unknown>).type);
      if (contentType) {
        contentTypes.push(contentType);
      }
      const text = (c as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text);
      }
      const refusal = (c as Record<string, unknown>).refusal;
      if (typeof refusal === "string" && refusal.trim()) {
        refusals.push(refusal);
      }
    }
  }

  const combined = chunks.join("\n").trim();
  if (combined) {
    return combined;
  }

  if (refusals.length > 0) {
    throw new Error(`Model refusal: ${refusals.join(" | ")}`);
  }

  const status = safeString(payload.status) || "unknown";
  const outputSummary = outputTypes.length ? outputTypes.join(",") : "none";
  const contentSummary = contentTypes.length ? contentTypes.join(",") : "none";
  throw new Error(
    `Empty model response (status=${status}, output_types=${outputSummary}, content_types=${contentSummary})`
  );
}

function isIncompleteStatus(payload: Record<string, unknown>): boolean {
  return safeString(payload.status).toLowerCase() === "incomplete";
}

async function callVisionModel(file: File): Promise<AiSuggestion> {
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const model = getSuggestionModel();
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;

  const requestOnce = async (maxOutputTokens: number): Promise<Record<string, unknown>> => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        text: {
          format: {
            type: "json_object",
          },
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Analyze this photo and suggest metadata for a photo blog.",
                  "Respond as strict JSON object with keys: title (string), slug (string), caption (string), tags (string[]).",
                  "Title should be primarily in Korean.",
                  "Keep title short (max 24 chars).",
                  "Slug must be English only, lowercase, and kebab-case for URL path.",
                  "Caption should be one concise Korean sentence (max 70 chars).",
                  "Tags must be English only, lowercase, kebab-case words/phrases, 3-5 items.",
                  "No markdown, no explanation, JSON only.",
                ].join(" "),
              },
              {
                type: "input_image",
                image_url: dataUrl,
              },
            ],
          },
        ],
        max_output_tokens: maxOutputTokens,
      }),
    });

    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const errorObject = raw.error;
      const message =
        errorObject && typeof errorObject === "object"
          ? safeString((errorObject as Record<string, unknown>).message)
          : "OpenAI API request failed";
      const type =
        errorObject && typeof errorObject === "object"
          ? safeString((errorObject as Record<string, unknown>).type)
          : "";
      const code =
        errorObject && typeof errorObject === "object"
          ? safeString((errorObject as Record<string, unknown>).code)
          : "";
      const param =
        errorObject && typeof errorObject === "object"
          ? safeString((errorObject as Record<string, unknown>).param)
          : "";
      const requestId = safeString(response.headers.get("x-request-id"));

      throw new OpenAiRequestError({
        status: response.status,
        message,
        type,
        code,
        param,
        requestId,
        model,
      });
    }

    return raw;
  };

  // Keep first attempt cheap, but allow larger retries to avoid incomplete reasoning-only responses.
  const tokenBudgets = [240, 640, 1400];
  let lastError: Error | null = null;

  for (const maxTokens of tokenBudgets) {
    const raw = await requestOnce(maxTokens);
    try {
      const text = readOutputText(raw);
      const parsed = extractJsonFromText(text);
      return parseSuggestion(parsed);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      lastError = error;

      const isJsonParseIssue = error.message.includes("Model did not return valid JSON");
      const isEmptyResponseIssue = error.message.includes("Empty model response");
      const shouldRetry = isIncompleteStatus(raw) || isJsonParseIssue || isEmptyResponseIssue;
      if (!shouldRetry || maxTokens === tokenBudgets[tokenBudgets.length - 1]) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Unknown model parsing error");
}

export async function POST(request: Request) {
  try {
    const authResult = await authorizeAdminRequest(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "file must be an image" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `file size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes` },
        { status: 400 }
      );
    }

    const suggestion = await callVisionModel(file);
    return NextResponse.json(suggestion);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (error instanceof OpenAiRequestError) {
      console.error("[ai-suggest] OpenAI request failed", error.payload);
      return NextResponse.json(
        {
          error: error.payload.message,
          model: error.payload.model,
          openaiStatus: error.payload.status,
          openaiType: error.payload.type,
          openaiCode: error.payload.code,
          openaiParam: error.payload.param,
          openaiRequestId: error.payload.requestId,
        },
        { status: 502 }
      );
    }
    if (message.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
