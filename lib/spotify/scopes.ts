export const SPOTIFY_SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
] as const;

export const SPOTIFY_SCOPE_STRING = SPOTIFY_SCOPES.join(" ");
