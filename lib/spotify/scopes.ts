export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
] as const;

export const SPOTIFY_SCOPE_STRING = SPOTIFY_SCOPES.join(" ");
