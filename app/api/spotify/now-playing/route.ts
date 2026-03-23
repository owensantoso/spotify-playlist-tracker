import { NextResponse } from "next/server";

import { setViewerSessionOnResponse } from "@/lib/session";
import { getCommentTrackPayload } from "@/lib/services/comment-service";
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
  const comments =
    nowPlaying?.spotifyTrackId
      ? await getCommentTrackPayload(nowPlaying.spotifyTrackId)
      : {
          featureAvailable: true,
          version: "0",
          markers: [],
          threads: [],
        };

  const response = NextResponse.json(
    { nowPlaying, comments, fetchedAt: Date.now() },
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
