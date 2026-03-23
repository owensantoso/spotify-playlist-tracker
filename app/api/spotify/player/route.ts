import { NextRequest, NextResponse } from "next/server";

import {
  pausePlayback,
  playPlayback,
  seekPlayback,
  skipToNext,
  skipToPrevious,
  SpotifyApiError,
  getPlaybackState,
} from "@/lib/spotify/client";
import { setViewerSessionOnResponse } from "@/lib/session";
import {
  getCurrentSpotifyAuth,
  withCurrentSpotifyAccessToken,
} from "@/lib/services/now-playing-service";
import type { ViewerSessionInput } from "@/lib/session";

const supportedActions = ["play", "pause", "next", "previous", "seek"] as const;

type PlayerAction = (typeof supportedActions)[number];

function isPlayerAction(value: string): value is PlayerAction {
  return supportedActions.includes(value as PlayerAction);
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentSpotifyAuth();
  if (!auth?.spotifyUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    positionMs?: number;
    trackId?: string;
    trackUri?: string;
  } | null;
  if (!body?.action || !isPlayerAction(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (
    body.action === "seek" &&
    (!Number.isFinite(body.positionMs) || typeof body.positionMs !== "number")
  ) {
    return NextResponse.json({ error: "Invalid seek position" }, { status: 400 });
  }

  let refreshedViewerSession: ViewerSessionInput | null = null;

  try {
    await withCurrentSpotifyAccessToken(async (accessToken, _auth, refreshedSession) => {
      refreshedViewerSession = refreshedSession;
      if (body.action === "play") {
        await playPlayback(
          accessToken,
          body.trackUri
            ? {
                uris: [body.trackUri],
              }
            : undefined,
        );
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

      if (body.action === "seek") {
        const playback = await getPlaybackState(accessToken);
        const currentTrackId =
          playback?.item && "id" in playback.item && typeof playback.item.id === "string"
            ? playback.item.id
            : null;

        if (!currentTrackId) {
          throw new SpotifyApiError("No active playback", 404, {
            code: "NO_ACTIVE_PLAYBACK",
          });
        }

        if (body.trackId && currentTrackId !== body.trackId) {
          throw new SpotifyApiError("Playback changed", 409, {
            code: "TRACK_CHANGED",
            currentTrackId,
          });
        }

        await seekPlayback(accessToken, body.positionMs!);
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
        {
          error: "Spotify rejected the playback request",
          status: error.status,
          code:
            typeof error.body === "object" &&
            error.body &&
            "code" in error.body &&
            typeof error.body.code === "string"
              ? error.body.code
              : undefined,
        },
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
