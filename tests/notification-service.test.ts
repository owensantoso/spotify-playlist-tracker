import { describe, expect, it } from "vitest";

import { buildDiscordMessage } from "@/lib/notifications/discord";

describe("buildDiscordMessage", () => {
  const payload = {
    lifecycles: [
      {
        trackSpotifyId: "track-1",
        trackName: "Track 1",
        artistNames: ["Artist 1"],
        spotifyUrl: "https://open.spotify.com/track/track-1",
        addedByDisplayName: "Alice",
      },
    ],
  };

  it("builds a batched Discord payload", () => {
    const message = buildDiscordMessage(payload, true);

    expect(Array.isArray(message)).toBe(false);
    expect(message).toMatchObject({
      content: "New playlist additions: 1",
    });
  });

  it("builds per-track payloads when batching is disabled", () => {
    const message = buildDiscordMessage(payload, false);

    expect(Array.isArray(message)).toBe(true);
    expect(message[0]?.content).toContain("Track 1");
  });
});
