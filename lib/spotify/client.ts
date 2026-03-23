import "server-only";

import { env } from "@/lib/env";
import { SPOTIFY_SCOPE_STRING } from "@/lib/spotify/scopes";
import type {
  SpotifyCurrentlyPlayingResponse,
  SpotifyPlaybackStateResponse,
  SpotifyPaging,
  SpotifyPlaylist,
  SpotifyPlaylistTrackItem,
  SpotifyTokenResponse,
  SpotifyUserProfile,
} from "@/lib/spotify/types";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com/api";

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

async function spotifyRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new SpotifyApiError(`Spotify API request failed for ${path}`, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
  });

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify token exchange failed with status ${response.status}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify token refresh failed with status ${response.status}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

export function buildSpotifyAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPE_STRING,
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function getCurrentUser(accessToken: string) {
  return spotifyRequest<SpotifyUserProfile>("/me", accessToken);
}

export function getCurrentlyPlaying(accessToken: string) {
  return spotifyRequest<SpotifyCurrentlyPlayingResponse | undefined>(
    "/me/player/currently-playing",
    accessToken,
  );
}

export function getPlaybackState(accessToken: string) {
  return spotifyRequest<SpotifyPlaybackStateResponse | undefined>("/me/player", accessToken);
}

export async function playPlayback(accessToken: string) {
  await spotifyRequest("/me/player/play", accessToken, {
    method: "PUT",
  });
}

export async function pausePlayback(accessToken: string) {
  await spotifyRequest("/me/player/pause", accessToken, {
    method: "PUT",
  });
}

export async function skipToNext(accessToken: string) {
  await spotifyRequest("/me/player/next", accessToken, {
    method: "POST",
  });
}

export async function skipToPrevious(accessToken: string) {
  await spotifyRequest("/me/player/previous", accessToken, {
    method: "POST",
  });
}

export function getPlaylist(accessToken: string, playlistId: string) {
  return spotifyRequest<SpotifyPlaylist>(`/playlists/${playlistId}`, accessToken);
}

export async function getAllPlaylistItems(accessToken: string, playlistId: string) {
  const items: SpotifyPlaylistTrackItem[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const page = await spotifyRequest<SpotifyPaging<SpotifyPlaylistTrackItem>>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
      accessToken,
    );

    items.push(...page.items);
    if (!page.next) {
      break;
    }

    offset += page.limit;
  }

  return items;
}

export async function addItemsToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: string[],
) {
  if (!uris.length) {
    return;
  }

  await spotifyRequest(
    `/playlists/${playlistId}/tracks`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ uris }),
    },
  );
}
