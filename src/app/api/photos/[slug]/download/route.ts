import { NextResponse } from "next/server";
import { AVIF_QUALITY_DOWNLOAD, ensureMinimumResolution } from "@/lib/image-resolution";
import { getPhotoBySlug } from "@/lib/photos";

type Params = {
  params: Promise<{ slug: string }>;
};

function shouldEnforceMinimum(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const value = searchParams.get("enforceMinimum");
  if (!value) {
    return true;
  }

  return value !== "0" && value.toLowerCase() !== "false";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTrustedPhotoSource(src: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return false;
  }

  try {
    const trusted = new URL(supabaseUrl);
    const candidate = new URL(src);
    return (
      candidate.protocol === trusted.protocol &&
      candidate.hostname === trusted.hostname &&
      candidate.pathname.startsWith("/storage/v1/object/public/photos/")
    );
  } catch {
    return false;
  }
}

function toSafeDownloadFilename(slug: string): string {
  const safe = slug.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "photo";
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const photo = await getPhotoBySlug(slug);
    const enforceMinimum = shouldEnforceMinimum(request);

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (!isTrustedPhotoSource(photo.src)) {
      return NextResponse.json({ error: "Untrusted photo source" }, { status: 502 });
    }

    const upstream = await fetch(photo.src, {
      cache: "force-cache",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to read source image" }, { status: 502 });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    const output = await ensureMinimumResolution({
      bytes: input,
      quality: AVIF_QUALITY_DOWNLOAD,
      outputFormat: "avif",
      enforceMinimum,
      fallbackWidth: photo.width,
      fallbackHeight: photo.height,
    });
    const body = new Uint8Array(output.data);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/avif",
        "Content-Disposition": `attachment; filename="${toSafeDownloadFilename(photo.slug)}.avif"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json({ error: "Image download timed out" }, { status: 502 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
