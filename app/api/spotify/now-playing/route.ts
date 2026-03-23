import { NextResponse } from "next/server";

import { getCurrentSpotifyAuth, getNowPlayingTrack } from "@/lib/services/now-playing-service";

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

  const nowPlaying = await getNowPlayingTrack();

  return NextResponse.json(
    { nowPlaying, fetchedAt: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
