import "server-only";

import { getCurrentUser, spotifyRequest } from "@/lib/spotify/client";
import type { SpotifyUserProfile } from "@/lib/spotify/types";
import { withAdminAccessToken } from "@/lib/services/admin-service";

function getPreferredImageUrl(profile: SpotifyUserProfile | null | undefined) {
  return profile?.images?.[0]?.url ?? null;
}

export async function getCurrentSpotifyUserProfileImage() {
  try {
    return await withAdminAccessToken(async (accessToken) => {
      const profile = await getCurrentUser(accessToken);
      return getPreferredImageUrl(profile);
    });
  } catch {
    return null;
  }
}

export async function getSpotifyUserAvatarMap(spotifyUserIds: Array<string | null | undefined>) {
  const uniqueUserIds = [...new Set(spotifyUserIds.filter((value): value is string => Boolean(value?.trim())))];
  if (!uniqueUserIds.length) {
    return {} as Record<string, string | null>;
  }

  try {
    return await withAdminAccessToken(async (accessToken) => {
      const profiles = await Promise.allSettled(
        uniqueUserIds.map(async (spotifyUserId) => {
          const profile = await spotifyRequest<SpotifyUserProfile>(
            `/users/${encodeURIComponent(spotifyUserId)}`,
            accessToken,
          );

          return [spotifyUserId, getPreferredImageUrl(profile)] as const;
        }),
      );

      return profiles.reduce<Record<string, string | null>>((avatarMap, result) => {
        if (result.status === "fulfilled") {
          const [spotifyUserId, imageUrl] = result.value;
          avatarMap[spotifyUserId] = imageUrl;
        }

        return avatarMap;
      }, {});
    });
  } catch {
    return {};
  }
}
