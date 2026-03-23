import "server-only";

import { db } from "@/lib/db";
import { decryptValue, encryptValue } from "@/lib/security";
import { refreshAccessToken, SpotifyApiError } from "@/lib/spotify/client";
import type { SpotifyUserProfile } from "@/lib/spotify/types";

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

async function upsertSpotifyUserProfile(profile: SpotifyUserProfile) {
  await db.spotifyUser.upsert({
    where: { spotifyUserId: profile.id },
    update: {
      displayName: profile.display_name,
      profileUrl: profile.external_urls?.spotify ?? null,
    },
    create: {
      spotifyUserId: profile.id,
      displayName: profile.display_name,
      profileUrl: profile.external_urls?.spotify ?? null,
    },
  });
}

export async function upsertUserAccount(params: {
  profile: SpotifyUserProfile;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scope: string;
}) {
  await upsertSpotifyUserProfile(params.profile);

  const tokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);

  return db.userAccount.upsert({
    where: { spotifyUserId: params.profile.id },
    update: {
      displayName: params.profile.display_name,
      profileUrl: params.profile.external_urls?.spotify ?? null,
      accessTokenEncrypted: encryptValue(params.accessToken),
      refreshTokenEncrypted: encryptValue(params.refreshToken),
      tokenExpiresAt,
      grantedScopes: params.scope.split(" ").filter(Boolean),
      lastAuthenticatedAt: new Date(),
    },
    create: {
      spotifyUserId: params.profile.id,
      displayName: params.profile.display_name,
      profileUrl: params.profile.external_urls?.spotify ?? null,
      accessTokenEncrypted: encryptValue(params.accessToken),
      refreshTokenEncrypted: encryptValue(params.refreshToken),
      tokenExpiresAt,
      grantedScopes: params.scope.split(" ").filter(Boolean),
      lastAuthenticatedAt: new Date(),
    },
  });
}

async function readStoredTokens(spotifyUserId: string) {
  const account = await db.userAccount.findUnique({
    where: { spotifyUserId },
  });

  if (!account) {
    throw new Error("Spotify user account has not completed sign in");
  }

  return {
    account,
    tokens: {
      accessToken: decryptValue(account.accessTokenEncrypted),
      refreshToken: decryptValue(account.refreshTokenEncrypted),
      expiresAt: account.tokenExpiresAt,
    } satisfies StoredTokens,
  };
}

async function persistRefreshedTokens(
  spotifyUserId: string,
  tokens: StoredTokens,
  scope?: string,
) {
  await db.userAccount.update({
    where: { spotifyUserId },
    data: {
      accessTokenEncrypted: encryptValue(tokens.accessToken),
      refreshTokenEncrypted: encryptValue(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      grantedScopes: scope ? scope.split(" ").filter(Boolean) : undefined,
    },
  });
}

async function ensureFreshAccessToken(spotifyUserId: string) {
  const { account, tokens } = await readStoredTokens(spotifyUserId);
  const expiresSoon = tokens.expiresAt.getTime() - Date.now() < 60_000;

  if (!expiresSoon) {
    return { account, accessToken: tokens.accessToken };
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const nextTokens = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  };

  await persistRefreshedTokens(account.spotifyUserId, nextTokens, refreshed.scope);
  return { account, accessToken: nextTokens.accessToken };
}

export async function withUserAccessToken<T>(
  spotifyUserId: string,
  callback: (accessToken: string) => Promise<T>,
) {
  const current = await ensureFreshAccessToken(spotifyUserId);

  try {
    return await callback(current.accessToken);
  } catch (error) {
    if (!(error instanceof SpotifyApiError) || error.status !== 401) {
      throw error;
    }

    const { account, tokens } = await readStoredTokens(spotifyUserId);
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    const nextTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    };

    await persistRefreshedTokens(account.spotifyUserId, nextTokens, refreshed.scope);
    return callback(nextTokens.accessToken);
  }
}

export async function getUserAccount(spotifyUserId: string) {
  return db.userAccount.findUnique({
    where: { spotifyUserId },
  });
}
