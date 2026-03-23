import { LifecycleStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildMatchFingerprint } from "@/lib/spotify/normalize";
import { reconcileLifecycles } from "@/lib/sync/reconcile";

describe("reconcileLifecycles", () => {
  it("keeps unchanged lifecycles matched and does not recreate them", () => {
    const fingerprint = buildMatchFingerprint("track-1", "2026-03-22T00:00:00.000Z", "user-1");
    const result = reconcileLifecycles(
      [
        {
          trackId: "track-1",
          trackName: "Track 1",
          artistNames: ["Artist 1"],
          albumName: "Album",
          artworkUrl: null,
          spotifyUrl: "https://open.spotify.com/track/track-1",
          spotifyUri: "spotify:track:track-1",
          durationMs: null,
          explicit: null,
          addedAt: new Date("2026-03-22T00:00:00.000Z"),
          addedBySpotifyUserId: "user-1",
          addedByDisplayName: "Alice",
          addedByProfileUrl: null,
          playlistPosition: 0,
          matchFingerprint: fingerprint,
          occurrenceOrdinal: 1,
        },
      ],
      [
        {
          id: "lifecycle-1",
          matchFingerprint: fingerprint,
          occurrenceOrdinal: 1,
          status: LifecycleStatus.ACTIVE,
        },
      ],
    );

    expect(result.matchedLifecycleIds).toEqual(["lifecycle-1"]);
    expect(result.lifecyclesToCreate).toHaveLength(0);
    expect(result.lifecyclesToRemove).toHaveLength(0);
  });

  it("creates a new lifecycle after removal", () => {
    const fingerprint = buildMatchFingerprint("track-1", "2026-03-25T00:00:00.000Z", "user-1");
    const result = reconcileLifecycles(
      [
        {
          trackId: "track-1",
          trackName: "Track 1",
          artistNames: ["Artist 1"],
          albumName: "Album",
          artworkUrl: null,
          spotifyUrl: "https://open.spotify.com/track/track-1",
          spotifyUri: "spotify:track:track-1",
          durationMs: null,
          explicit: null,
          addedAt: new Date("2026-03-25T00:00:00.000Z"),
          addedBySpotifyUserId: "user-1",
          addedByDisplayName: "Alice",
          addedByProfileUrl: null,
          playlistPosition: 0,
          matchFingerprint: fingerprint,
          occurrenceOrdinal: 1,
        },
      ],
      [],
    );

    expect(result.matchedLifecycleIds).toHaveLength(0);
    expect(result.lifecyclesToCreate).toHaveLength(1);
  });

  it("removes active rows that disappeared from the playlist", () => {
    const fingerprint = buildMatchFingerprint("track-1", "2026-03-22T00:00:00.000Z", "user-1");
    const result = reconcileLifecycles([], [
      {
        id: "lifecycle-1",
        matchFingerprint: fingerprint,
        occurrenceOrdinal: 1,
        status: LifecycleStatus.ACTIVE,
      },
    ]);

    expect(result.lifecyclesToRemove).toEqual(["lifecycle-1"]);
  });
});
