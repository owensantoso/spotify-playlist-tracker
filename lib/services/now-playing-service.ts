import "server-only";

import { romanizeText } from "@/lib/romanization";
import type { ViewerSessionInput } from "@/lib/session";
import { getAdminSession, getViewerSession } from "@/lib/session";
import { refreshAccessToken, SpotifyApiError, getPlaybackState } from "@/lib/spotify/client";
import { withAdminAccessToken } from "@/lib/services/admin-service";
import type { SpotifyTrack } from "@/lib/spotify/types";

export type NowPlayingTrack = {
  spotifyTrackId: string;
  title: string;
  titleRomanized: string | null;
  artists: string[];
  artistsRomanized: string[];
  albumName: string | null;
  artworkUrl: string | null;
  spotifyUrl: string | null;
  durationMs: number | null;
  progressMs: number;
  deviceName: string | null;
  isPlaying: boolean;
};

type SpotifyPlayableTrack = SpotifyTrack & {
  id: string;
};

type CurrentSpotifyAuth =
  | {
      kind: "viewer";
      spotifyUserId: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
    }
  | { kind: "admin"; spotifyUserId: string }
  | null;

type CurrentSpotifyAccessContext =
  | {
      auth: Exclude<CurrentSpotifyAuth, null>;
      accessToken: string;
      refreshedViewerSession: ViewerSessionInput | null;
    }
  | null;

function isPlayableTrack(
  track: SpotifyTrack | { type: string } | null | undefined,
): track is SpotifyPlayableTrack {
  return Boolean(track && track.type === "track" && "id" in track && track.id);
}

export async function getCurrentSpotifyAuth(): Promise<CurrentSpotifyAuth> {
  const [viewerSession, adminSession] = await Promise.all([getViewerSession(), getAdminSession()]);

  if (viewerSession?.spotifyUserId) {
    return {
      kind: "viewer",
      spotifyUserId: viewerSession.spotifyUserId,
      accessToken: viewerSession.accessToken,
      refreshToken: viewerSession.refreshToken,
      tokenExpiresAt: viewerSession.tokenExpiresAt,
    };
  }

  if (adminSession?.spotifyUserId) {
    return {
      kind: "admin",
      spotifyUserId: adminSession.spotifyUserId,
    };
  }

  return null;
}

async function getCurrentSpotifyAccessContext({
  refreshViewerSession = false,
}: {
  refreshViewerSession?: boolean;
} = {}): Promise<CurrentSpotifyAccessContext> {
  const auth = await getCurrentSpotifyAuth();
  if (!auth) {
    return null;
  }

  if (auth.kind === "viewer") {
    const expiresSoon = auth.tokenExpiresAt.getTime() - Date.now() < 60_000;
    if (!expiresSoon) {
      return {
        auth,
        accessToken: auth.accessToken,
        refreshedViewerSession: null,
      };
    }

    if (!refreshViewerSession) {
      return null;
    }

    const refreshed = await refreshAccessToken(auth.refreshToken);
    return {
      auth,
      accessToken: refreshed.access_token,
      refreshedViewerSession: {
        spotifyUserId: auth.spotifyUserId,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? auth.refreshToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    };
  }

  return {
    auth,
    accessToken: await withAdminAccessToken(async (accessToken) => accessToken),
    refreshedViewerSession: null,
  };
}

export async function withCurrentSpotifyAccessToken<T>(
  callback: (
    accessToken: string,
    auth: Exclude<CurrentSpotifyAuth, null>,
    refreshedViewerSession: ViewerSessionInput | null,
  ) => Promise<T>,
  options: {
    refreshViewerSession?: boolean;
  } = {},
) {
  const context = await getCurrentSpotifyAccessContext(options);
  if (!context) {
    throw new Error("No Spotify session is active");
  }

  return callback(context.accessToken, context.auth, context.refreshedViewerSession);
}

export async function withViewerSpotifyAccessToken<T>(
  callback: (
    accessToken: string,
    auth: Extract<Exclude<CurrentSpotifyAuth, null>, { kind: "viewer" }>,
    refreshedViewerSession: ViewerSessionInput | null,
  ) => Promise<T>,
  options: {
    refreshViewerSession?: boolean;
  } = {},
) {
  const auth = await getCurrentSpotifyAuth();
  if (!auth || auth.kind !== "viewer") {
    throw new Error("No viewer Spotify session is active");
  }

  const expiresSoon = auth.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) {
    return callback(auth.accessToken, auth, null);
  }

  if (!options.refreshViewerSession) {
    throw new Error("Viewer Spotify session refresh is required");
  }

  const refreshed = await refreshAccessToken(auth.refreshToken);
  const refreshedViewerSession = {
    spotifyUserId: auth.spotifyUserId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? auth.refreshToken,
    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  };

  return callback(
    refreshedViewerSession.accessToken,
    {
      kind: "viewer",
      spotifyUserId: refreshedViewerSession.spotifyUserId,
      accessToken: refreshedViewerSession.accessToken,
      refreshToken: refreshedViewerSession.refreshToken,
      tokenExpiresAt: refreshedViewerSession.tokenExpiresAt,
    },
    refreshedViewerSession,
  );
}

export async function getNowPlayingResult(
  options: {
    refreshViewerSession?: boolean;
  } = {},
): Promise<{ nowPlaying: NowPlayingTrack | null; refreshedViewerSession: ViewerSessionInput | null }> {
  const auth = await getCurrentSpotifyAuth();
  if (!auth?.spotifyUserId) {
    return {
      nowPlaying: null,
      refreshedViewerSession: null,
    };
  }

  try {
    return await withCurrentSpotifyAccessToken(
      async (accessToken, _auth, refreshedViewerSession) => {
        const playback = await getPlaybackState(accessToken);
        if (!isPlayableTrack(playback?.item)) {
          return {
            nowPlaying: null,
            refreshedViewerSession,
          };
        }

        const [titleRomanized, artistsRomanized] = await Promise.all([
          romanizeText(playback.item.name),
          Promise.all(
            (playback.item.artists ?? []).map(async (artist) => (await romanizeText(artist.name)) ?? artist.name),
          ),
        ]);

        return {
          nowPlaying: {
            spotifyTrackId: playback.item.id,
            title: playback.item.name,
            titleRomanized,
            artists: playback.item.artists?.map((artist) => artist.name).filter(Boolean) ?? [],
            artistsRomanized,
            albumName: playback.item.album?.name ?? null,
            artworkUrl: playback.item.album?.images?.[0]?.url ?? null,
            spotifyUrl: playback.item.external_urls?.spotify ?? null,
            durationMs: playback.item.duration_ms ?? null,
            progressMs: playback.progress_ms ?? 0,
            deviceName: playback.device?.name ?? null,
            isPlaying: playback.is_playing,
          },
          refreshedViewerSession,
        };
      },
      options,
    );
  } catch (error) {
    if (error instanceof SpotifyApiError && [204, 401, 403, 429].includes(error.status)) {
      return {
        nowPlaying: null,
        refreshedViewerSession: null,
      };
    }

    return {
      nowPlaying: null,
      refreshedViewerSession: null,
    };
  }
}

export async function getNowPlayingTrack(
  options: {
    refreshViewerSession?: boolean;
  } = {},
): Promise<NowPlayingTrack | null> {
  return (await getNowPlayingResult(options)).nowPlaying;
}
