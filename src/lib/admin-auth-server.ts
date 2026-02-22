import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string };

type AuthorizeOptions = {
  formData?: FormData | null;
  allowLegacyToken?: boolean;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name];
  return value ? value : null;
}

function parseBooleanEnv(name: string): boolean {
  const value = getOptionalEnv(name);
  if (!value) {
    return false;
  }

  return value.trim().toLowerCase() === "true";
}

function safeTokenEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
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

export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authorizeAdminRequest(
  request: Request,
  options?: AuthorizeOptions
): Promise<AdminAuthResult> {
  const allowLegacyToken = options?.allowLegacyToken ?? false;
  const legacyTokenEnabled = parseBooleanEnv("ADMIN_UPLOAD_LEGACY_TOKEN_ENABLED");

  if (allowLegacyToken && legacyTokenEnabled) {
    const legacyToken = getOptionalEnv("ADMIN_UPLOAD_TOKEN");
    const formToken = String(options?.formData?.get("token") ?? "").trim();

    if (legacyToken && formToken && safeTokenEquals(formToken, legacyToken)) {
      return { ok: true, email: "legacy-token" };
    }
  }

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
