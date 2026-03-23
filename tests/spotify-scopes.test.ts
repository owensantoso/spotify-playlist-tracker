import { describe, expect, it } from "vitest";

import { SPOTIFY_SCOPES } from "@/lib/spotify/scopes";

describe("SPOTIFY_SCOPES", () => {
  it("requests the profile scopes needed for /me", () => {
    expect(SPOTIFY_SCOPES).toContain("user-read-private");
    expect(SPOTIFY_SCOPES).toContain("user-read-email");
  });
});
