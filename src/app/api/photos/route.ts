import { NextResponse } from "next/server";
import { getPhotosPage } from "@/lib/photos";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const data = await getPhotosPage({ cursor, limit });
  return NextResponse.json(data);
}
