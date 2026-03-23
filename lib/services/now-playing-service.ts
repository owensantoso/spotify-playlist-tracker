import "server-only";

import { getAdminSession } from "@/lib/session";
import { SpotifyApiError, getCurrentlyPlaying } from "@/lib/spotify/client";
import { withAdminAccessToken } from "@/lib/services/admin-service";
import type { SpotifyTrack } from "@/lib/spotify/types";

export type NowPlayingTrack = {
  spotifyTrackId: string;
  title: string;
  artists: string[];
  artworkUrl: string | null;
  spotifyUrl: string | null;
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
      const playback = await getCurrentlyPlaying(accessToken);
      if (!isPlayableTrack(playback?.item)) {
        return null;
      }

      return {
        spotifyTrackId: playback.item.id,
        title: playback.item.name,
        artists: playback.item.artists?.map((artist) => artist.name).filter(Boolean) ?? [],
        artworkUrl: playback.item.album?.images?.[0]?.url ?? null,
        spotifyUrl: playback.item.external_urls?.spotify ?? null,
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
