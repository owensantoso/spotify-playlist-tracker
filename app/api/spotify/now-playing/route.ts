import { NextResponse } from "next/server";

import { setViewerSessionOnResponse } from "@/lib/session";
import {
  getCurrentSpotifyAuth,
  getNowPlayingResult,
} from "@/lib/services/now-playing-service";

export async function GET() {
  const auth = await getCurrentSpotifyAuth();
  if (!auth?.spotifyUserId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { nowPlaying, refreshedViewerSession } = await getNowPlayingResult({
    refreshViewerSession: true,
  });

  const response = NextResponse.json(
    { nowPlaying, fetchedAt: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  if (refreshedViewerSession) {
    setViewerSessionOnResponse(response, refreshedViewerSession);
  }

  return response;
}
