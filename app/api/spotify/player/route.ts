import { NextRequest, NextResponse } from "next/server";

import {
  pausePlayback,
  playPlayback,
  skipToNext,
  skipToPrevious,
  SpotifyApiError,
} from "@/lib/spotify/client";
import { getAdminSession } from "@/lib/session";
import { withAdminAccessToken } from "@/lib/services/admin-service";
import { getNowPlayingTrack } from "@/lib/services/now-playing-service";

const supportedActions = ["play", "pause", "next", "previous"] as const;

type PlayerAction = (typeof supportedActions)[number];

function isPlayerAction(value: string): value is PlayerAction {
  return supportedActions.includes(value as PlayerAction);
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.spotifyUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (!body?.action || !isPlayerAction(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    await withAdminAccessToken(async (accessToken) => {
      if (body.action === "play") {
        await playPlayback(accessToken);
        return;
      }

      if (body.action === "pause") {
        await pausePlayback(accessToken);
        return;
      }

      if (body.action === "next") {
        await skipToNext(accessToken);
        return;
      }

      await skipToPrevious(accessToken);
    });

    const nowPlaying = await getNowPlayingTrack();
    return NextResponse.json({ nowPlaying });
  } catch (error) {
    if (error instanceof SpotifyApiError) {
      return NextResponse.json(
        { error: "Spotify rejected the playback request", status: error.status },
        { status: error.status === 404 ? 409 : error.status },
      );
    }

    return NextResponse.json({ error: "Playback request failed" }, { status: 500 });
  }
}
