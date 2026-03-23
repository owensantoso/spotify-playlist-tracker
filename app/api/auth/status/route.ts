import { NextResponse } from "next/server";

import { getAdminSession, getViewerSession } from "@/lib/session";

export async function GET() {
  const [adminSession, viewerSession] = await Promise.all([getAdminSession(), getViewerSession()]);

  return NextResponse.json(
    {
      isAuthenticated: Boolean(viewerSession?.spotifyUserId || adminSession?.spotifyUserId),
      isAdmin: Boolean(adminSession?.spotifyUserId),
      isViewer: Boolean(viewerSession?.spotifyUserId),
      spotifyUserId: viewerSession?.spotifyUserId ?? adminSession?.spotifyUserId ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
