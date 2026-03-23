import type { NormalizedPlaylistTrack, SpotifyPlaylistTrackItem } from "@/lib/spotify/types";

const NULL_SENTINEL = "__null__";

export function buildMatchFingerprint(
  trackId: string,
  addedAt: string | null,
  addedBySpotifyUserId: string | null,
) {
  return [trackId, addedAt ?? NULL_SENTINEL, addedBySpotifyUserId ?? NULL_SENTINEL].join("::");
}

export function normalizePlaylistItems(items: SpotifyPlaylistTrackItem[]) {
  const warnings: string[] = [];
  const fingerprintCounts = new Map<string, number>();
  const normalized: NormalizedPlaylistTrack[] = [];

  items.forEach((item, playlistPosition) => {
    if (!item.track) {
      warnings.push(`Skipped item at position ${playlistPosition}: missing track payload`);
      return;
    }

    if (item.track.type !== "track") {
      warnings.push(`Skipped item at position ${playlistPosition}: unsupported item type "${item.track.type}"`);
      return;
    }

    if (!("id" in item.track) || !item.track.id || item.track.is_local || item.is_local) {
      warnings.push(`Skipped item at position ${playlistPosition}: unavailable or local track`);
      return;
    }

    const matchFingerprint = buildMatchFingerprint(
      item.track.id,
      item.added_at,
      item.added_by?.id ?? null,
    );
    const nextOrdinal = (fingerprintCounts.get(matchFingerprint) ?? 0) + 1;
    fingerprintCounts.set(matchFingerprint, nextOrdinal);

    normalized.push({
      trackId: item.track.id,
      trackName: item.track.name,
      trackNameRomanized: null,
      artistNames: item.track.artists?.map((artist) => artist.name) ?? [],
      artistNamesRomanized: [],
      artistSpotifyUrls:
        item.track.artists?.map((artist) =>
          artist.id ? `https://open.spotify.com/artist/${artist.id}` : "",
        ).filter(Boolean) ?? [],
      albumName: item.track.album?.name ?? null,
      artworkUrl: item.track.album?.images?.[0]?.url ?? null,
      spotifyUrl: item.track.external_urls?.spotify ?? `https://open.spotify.com/track/${item.track.id}`,
      spotifyUri: item.track.uri,
      durationMs: item.track.duration_ms ?? null,
      explicit: item.track.explicit ?? null,
      addedAt: item.added_at ? new Date(item.added_at) : null,
      addedBySpotifyUserId: item.added_by?.id ?? null,
      addedByDisplayName: item.added_by?.display_name ?? null,
      addedByProfileUrl: item.added_by?.external_urls?.spotify ?? null,
      playlistPosition,
      matchFingerprint,
      occurrenceOrdinal: nextOrdinal,
    });
  });

  return { normalized, warnings };
}
