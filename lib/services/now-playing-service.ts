import "server-only";

import { romanizeText } from "@/lib/romanization";
import { getAdminSession, getViewerSession } from "@/lib/session";
import { SpotifyApiError, getPlaybackState } from "@/lib/spotify/client";
import { withAdminAccessToken } from "@/lib/services/admin-service";
import { withUserAccessToken } from "@/lib/services/user-account-service";
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
  | { kind: "viewer"; spotifyUserId: string }
  | { kind: "admin"; spotifyUserId: string }
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

export async function withCurrentSpotifyAccessToken<T>(
  callback: (accessToken: string, auth: Exclude<CurrentSpotifyAuth, null>) => Promise<T>,
) {
  const auth = await getCurrentSpotifyAuth();
  if (!auth) {
    throw new Error("No Spotify session is active");
  }

  if (auth.kind === "viewer") {
    return withUserAccessToken(auth.spotifyUserId, async (accessToken) => callback(accessToken, auth));
  }

  return withAdminAccessToken(async (accessToken) => callback(accessToken, auth));
}

export async function getNowPlayingTrack(): Promise<NowPlayingTrack | null> {
  const auth = await getCurrentSpotifyAuth();
  if (!auth?.spotifyUserId) {
    return null;
  }

  try {
    return await withCurrentSpotifyAccessToken(async (accessToken) => {
      const playback = await getPlaybackState(accessToken);
      if (!isPlayableTrack(playback?.item)) {
        return null;
      }

      const [titleRomanized, artistsRomanized] = await Promise.all([
        romanizeText(playback.item.name),
        Promise.all(
          (playback.item.artists ?? []).map(async (artist) => (await romanizeText(artist.name)) ?? artist.name),
        ),
      ]);

      return {
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
      };
    });
  } catch (error) {
    if (error instanceof SpotifyApiError && [204, 401, 403, 429].includes(error.status)) {
      return null;
    }

    return null;
  }
}
