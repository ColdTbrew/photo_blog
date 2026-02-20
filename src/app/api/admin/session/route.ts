import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin-auth-server";

export async function GET(request: Request) {
  const authResult = await authorizeAdminRequest(request);

  if (!authResult.ok) {
    if (authResult.status === 401 || authResult.status === 403) {
      return NextResponse.json({ isAdmin: false }, { status: authResult.status });
    }

    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  return NextResponse.json({
    isAdmin: true,
    email: authResult.email,
  });
}
