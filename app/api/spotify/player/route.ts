import { NextRequest, NextResponse } from "next/server";

import {
  pausePlayback,
  playPlayback,
  skipToNext,
  skipToPrevious,
  SpotifyApiError,
} from "@/lib/spotify/client";
import { setViewerSessionOnResponse } from "@/lib/session";
import {
  getCurrentSpotifyAuth,
  withCurrentSpotifyAccessToken,
} from "@/lib/services/now-playing-service";
import type { ViewerSessionInput } from "@/lib/session";

const supportedActions = ["play", "pause", "next", "previous"] as const;

type PlayerAction = (typeof supportedActions)[number];

function isPlayerAction(value: string): value is PlayerAction {
  return supportedActions.includes(value as PlayerAction);
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentSpotifyAuth();
  if (!auth?.spotifyUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (!body?.action || !isPlayerAction(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  let refreshedViewerSession: ViewerSessionInput | null = null;

  try {
    await withCurrentSpotifyAccessToken(async (accessToken, _auth, refreshedSession) => {
      refreshedViewerSession = refreshedSession;
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
    }, { refreshViewerSession: true });

    const response = NextResponse.json({ ok: true });

    if (refreshedViewerSession) {
      setViewerSessionOnResponse(response, refreshedViewerSession);
    }

    return response;
  } catch (error) {
    if (error instanceof SpotifyApiError) {
      const response = NextResponse.json(
        { error: "Spotify rejected the playback request", status: error.status },
        { status: error.status === 404 ? 409 : error.status },
      );

      if (refreshedViewerSession) {
        setViewerSessionOnResponse(response, refreshedViewerSession);
      }

      return response;
    }

    const response = NextResponse.json({ error: "Playback request failed" }, { status: 500 });

    if (refreshedViewerSession) {
      setViewerSessionOnResponse(response, refreshedViewerSession);
    }

    return response;
  }
}
