import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const envValues = {
  DATABASE_URL: "https://example.com/db",
  APP_URL: "https://spotify-playlist-tracker.vercel.app",
  SESSION_SECRET: "1234567890abcdef",
  TOKEN_ENCRYPTION_KEY: "1234567890abcdef",
  CRON_SECRET: "1234567890abcdef",
  SPOTIFY_CLIENT_ID: "spotify-client-id",
  SPOTIFY_CLIENT_SECRET: "spotify-client-secret",
  SPOTIFY_REDIRECT_URI: "https://spotify-playlist-tracker.vercel.app/api/auth/spotify/callback",
  MAIN_PLAYLIST_ID: "main-playlist",
  ARCHIVE_PLAYLIST_ID: "archive-playlist",
};

function setRequiredEnv() {
  for (const [key, value] of Object.entries(envValues)) {
    process.env[key] = value;
  }
}

describe("spotifyRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("preserves non-JSON error bodies without re-reading the response stream", async () => {
    setRequiredEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>spotify upstream error</html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const { spotifyRequest } = await import("@/lib/spotify/client");

    await expect(spotifyRequest("/me", "token")).rejects.toMatchObject({
      message: "Spotify API request failed for /me",
      status: 502,
      body: "<html>spotify upstream error</html>",
    });
  });
});
