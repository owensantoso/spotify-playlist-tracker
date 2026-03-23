import { describe, expect, it } from "vitest";

import { buildMatchFingerprint, normalizePlaylistItems } from "@/lib/spotify/normalize";
import type { SpotifyPlaylistTrackItem } from "@/lib/spotify/types";

describe("normalizePlaylistItems", () => {
  it("keeps duplicate fingerprints distinct with occurrence ordinals", () => {
    const items: SpotifyPlaylistTrackItem[] = [
      {
        added_at: "2026-03-22T00:00:00.000Z",
        added_by: { id: "user-1", display_name: "Alice", external_urls: { spotify: "https://spotify.com/u1" } },
        track: {
          type: "track",
          id: "track-1",
          name: "Track 1",
          uri: "spotify:track:track-1",
          album: { name: "Album", images: [{ url: "https://img/1" }] },
          artists: [{ id: "artist-1", name: "Artist 1" }],
          external_urls: { spotify: "https://open.spotify.com/track/track-1" },
        },
      },
      {
        added_at: "2026-03-22T00:00:00.000Z",
        added_by: { id: "user-1", display_name: "Alice", external_urls: { spotify: "https://spotify.com/u1" } },
        track: {
          type: "track",
          id: "track-1",
          name: "Track 1",
          uri: "spotify:track:track-1",
          album: { name: "Album", images: [{ url: "https://img/1" }] },
          artists: [{ id: "artist-1", name: "Artist 1" }],
          external_urls: { spotify: "https://open.spotify.com/track/track-1" },
        },
      },
    ];

    const result = normalizePlaylistItems(items);

    expect(result.warnings).toHaveLength(0);
    expect(result.normalized.map((item) => item.occurrenceOrdinal)).toEqual([1, 2]);
    expect(result.normalized[0]?.matchFingerprint).toBe(
      buildMatchFingerprint("track-1", "2026-03-22T00:00:00.000Z", "user-1"),
    );
  });

  it("warns and skips unsupported tracks", () => {
    const items: SpotifyPlaylistTrackItem[] = [
      {
        added_at: null,
        added_by: null,
        track: null,
      },
      {
        added_at: null,
        added_by: null,
        track: {
          type: "episode",
        },
      },
    ];

    const result = normalizePlaylistItems(items);

    expect(result.normalized).toHaveLength(0);
    expect(result.warnings).toHaveLength(2);
  });
});
