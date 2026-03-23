import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/session";
import { getNowPlayingTrack } from "@/lib/services/now-playing-service";

export async function GET() {
  const session = await getAdminSession();
  if (!session?.spotifyUserId) {
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
