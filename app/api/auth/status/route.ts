import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/session";

export async function GET() {
  const session = await getAdminSession();

  return NextResponse.json(
    { isAuthenticated: Boolean(session?.spotifyUserId) },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
