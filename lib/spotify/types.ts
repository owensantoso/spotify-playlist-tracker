export type SpotifyExternalUrls = {
  spotify?: string;
};

export type SpotifyUserProfile = {
  id: string;
  display_name: string | null;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyPlaylistOwner = {
  id: string;
  display_name?: string | null;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  public: boolean | null;
  collaborative: boolean;
  snapshot_id?: string;
  owner: SpotifyPlaylistOwner;
};

export type SpotifyTrackArtist = {
  id: string | null;
  name: string;
};

export type SpotifyTrack = {
  type: "track";
  id: string | null;
  name: string;
  uri: string;
  duration_ms?: number;
  explicit?: boolean;
  is_local?: boolean;
  album?: {
    name?: string;
    images?: Array<{ url: string }>;
  };
  artists?: SpotifyTrackArtist[];
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyPlaylistItemTrack = SpotifyTrack | { type: string } | null;

export type SpotifyPlaylistTrackItem = {
  added_at: string | null;
  added_by: SpotifyUserProfile | null;
  is_local?: boolean;
  track: SpotifyPlaylistItemTrack;
};

export type SpotifyPaging<T> = {
  items: T[];
  next: string | null;
  total: number;
  limit: number;
  offset: number;
};

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export type NormalizedPlaylistTrack = {
  trackId: string;
  trackName: string;
  trackNameRomanized: string | null;
  artistNames: string[];
  artistNamesRomanized: string[];
  artistSpotifyUrls: string[];
  albumName: string | null;
  artworkUrl: string | null;
  spotifyUrl: string;
  spotifyUri: string;
  durationMs: number | null;
  explicit: boolean | null;
  addedAt: Date | null;
  addedBySpotifyUserId: string | null;
  addedByDisplayName: string | null;
  addedByProfileUrl: string | null;
  playlistPosition: number;
  matchFingerprint: string;
  occurrenceOrdinal: number;
};
