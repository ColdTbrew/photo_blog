import { NextResponse } from "next/server";
import { authorizeAdminRequest, createServiceRoleClient } from "@/lib/admin-auth-server";
import { invalidatePhotosCache } from "@/lib/photos";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

function parseTakenAt(raw: unknown): string | null {
  if (raw === null) {
    return null;
  }

  const value = String(raw ?? "").trim();
  if (!value || value.toLowerCase() === "none") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("takenAt is not a valid date");
  }

  return parsed.toISOString().slice(0, 10);
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await authorizeAdminRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { slug } = await context.params;
    const body = (await request.json()) as {
      title?: unknown;
      caption?: unknown;
      tags?: unknown;
      takenAt?: unknown;
      slug?: unknown;
    };

    const title = String(body.title ?? "").trim();
    const caption = String(body.caption ?? "").trim();
    const nextSlugRaw = String(body.slug ?? "").trim();

    if (!title || !caption) {
      return NextResponse.json({ error: "title and caption are required" }, { status: 400 });
    }

    const nextSlug = toSlug(nextSlugRaw || slug);
    if (!nextSlug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const tags = parseTags(body.tags);
    const takenAt = parseTakenAt(body.takenAt);

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("photos")
      .update({
        title,
        caption,
        tags,
        taken_at: takenAt,
        slug: nextSlug,
      })
      .eq("slug", slug)
      .select("id, slug, src, width, height, title, caption, tags, taken_at, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }

      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidatePhotosCache();
    return NextResponse.json({
      ok: true,
      slug: data.slug,
      photo: {
        id: data.id,
        slug: data.slug,
        src: data.src,
        width: data.width,
        height: data.height,
        title: data.title,
        caption: data.caption,
        tags: data.tags,
        takenAt: data.taken_at,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await authorizeAdminRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { slug } = await context.params;
    const supabase = createServiceRoleClient();

    const { data: found, error: findError } = await supabase
      .from("photos")
      .select("id, slug, storage_path")
      .eq("slug", slug)
      .single();

    if (findError) {
      if (findError.code === "PGRST116") {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }

      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from("photos").delete().eq("id", found.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    let warning: string | null = null;
    if (found.storage_path) {
      const { error: storageError } = await supabase.storage.from("photos").remove([found.storage_path]);
      if (storageError) {
        warning = storageError.message;
      }
    }

    invalidatePhotosCache();
    return NextResponse.json({
      ok: true,
      deletedSlug: found.slug,
      partialWarning: warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
