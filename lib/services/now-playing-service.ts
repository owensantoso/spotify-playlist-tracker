import "server-only";

import { getAdminSession } from "@/lib/session";
import { SpotifyApiError, getPlaybackState } from "@/lib/spotify/client";
import { withAdminAccessToken } from "@/lib/services/admin-service";
import type { SpotifyTrack } from "@/lib/spotify/types";

export type NowPlayingTrack = {
  spotifyTrackId: string;
  title: string;
  artists: string[];
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

function isPlayableTrack(
  track: SpotifyTrack | { type: string } | null | undefined,
): track is SpotifyPlayableTrack {
  return Boolean(track && track.type === "track" && "id" in track && track.id);
}

export async function getNowPlayingTrack(): Promise<NowPlayingTrack | null> {
  const session = await getAdminSession();
  if (!session?.spotifyUserId) {
    return null;
  }

  try {
    return await withAdminAccessToken(async (accessToken) => {
      const playback = await getPlaybackState(accessToken);
      if (!isPlayableTrack(playback?.item)) {
        return null;
      }

      return {
        spotifyTrackId: playback.item.id,
        title: playback.item.name,
        artists: playback.item.artists?.map((artist) => artist.name).filter(Boolean) ?? [],
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
