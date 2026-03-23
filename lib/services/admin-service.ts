import "server-only";

import { db } from "@/lib/db";
import { decryptValue, encryptValue } from "@/lib/security";
import { refreshAccessToken, SpotifyApiError } from "@/lib/spotify/client";
import type { SpotifyUserProfile } from "@/lib/spotify/types";
import { upsertSpotifyUserProfile } from "@/lib/services/user-account-service";

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export async function upsertAdminAccount(params: {
  profile: SpotifyUserProfile;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scope: string;
}) {
  const existingAdmin = await db.adminAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existingAdmin && existingAdmin.spotifyUserId !== params.profile.id) {
    throw new Error("A different Spotify account is already configured as the admin");
  }

  const tokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);

  await upsertSpotifyUserProfile(params.profile);

  return db.adminAccount.upsert({
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

async function readStoredTokens() {
  const account = await db.adminAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    throw new Error("Admin account has not completed Spotify setup");
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
  await db.adminAccount.update({
    where: { spotifyUserId },
    data: {
      accessTokenEncrypted: encryptValue(tokens.accessToken),
      refreshTokenEncrypted: encryptValue(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      grantedScopes: scope ? scope.split(" ").filter(Boolean) : undefined,
    },
  });
}

async function ensureFreshAccessToken() {
  const { account, tokens } = await readStoredTokens();
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

export async function withAdminAccessToken<T>(
  callback: (accessToken: string) => Promise<T>,
) {
  const current = await ensureFreshAccessToken();

  try {
    return await callback(current.accessToken);
  } catch (error) {
    if (!(error instanceof SpotifyApiError) || error.status !== 401) {
      throw error;
    }

    const { account, tokens } = await readStoredTokens();
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

export async function getAdminAccount() {
  return db.adminAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });
}
