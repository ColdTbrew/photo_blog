import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

type AiSuggestion = {
  title: string;
  caption: string;
  tags: string[];
};

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
  return normalized.slice(0, 400);
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedup = new Set<string>();
  for (const item of value) {
    const tag = safeString(item).toLowerCase().replace(/\s+/g, "-");
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
  return JSON.parse(target);
}

function parseSuggestion(raw: unknown): AiSuggestion {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid suggestion shape");
  }

  const obj = raw as Record<string, unknown>;
  const title = sanitizeTitle(obj.title);
  const caption = sanitizeCaption(obj.caption);
  const tags = sanitizeTags(obj.tags);

  if (!title || !caption) {
    throw new Error("Suggestion missing title or caption");
  }

  return { title, caption, tags };
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
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      const text = (c as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text);
      }
    }
  }

  return chunks.join("\n").trim();
}

async function callVisionModel(file: File): Promise<AiSuggestion> {
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const model = getSuggestionModel();
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Analyze this photo and suggest metadata for a photo blog.",
                "Respond as strict JSON object with keys: title (string), caption (string), tags (string[]).",
                "Use concise, natural language and 3-8 relevant tags.",
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
      max_output_tokens: 300,
    }),
  });

  const raw = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errorObject = raw.error;
    const details =
      errorObject && typeof errorObject === "object"
        ? safeString((errorObject as Record<string, unknown>).message)
        : "";
    throw new Error(details ? `OpenAI API error: ${details}` : "OpenAI API request failed");
  }

  const text = readOutputText(raw);
  if (!text) {
    throw new Error("Empty model response");
  }

  const parsed = extractJsonFromText(text);
  return parseSuggestion(parsed);
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
    if (message.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
