import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getCurrentUser, spotifyRequest } from "@/lib/spotify/client";
import type { SpotifyUserProfile } from "@/lib/spotify/types";
import { withAdminAccessToken } from "@/lib/services/admin-service";

function getPreferredImageUrl(profile: SpotifyUserProfile | null | undefined) {
  return profile?.images?.[0]?.url ?? null;
}

function normalizeStoredImageUrl(imageUrl: string | null) {
  return imageUrl || null;
}

function isMissingImageColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
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

  let avatarMap: Record<string, string | null> = {};

  try {
    try {
      const storedUsers = await db.spotifyUser.findMany({
        where: {
          spotifyUserId: {
            in: uniqueUserIds,
          },
        },
        select: {
          spotifyUserId: true,
          imageUrl: true,
        },
      });

      avatarMap = storedUsers.reduce<Record<string, string | null>>((map, user) => {
        if (user.imageUrl !== null) {
          map[user.spotifyUserId] = normalizeStoredImageUrl(user.imageUrl);
        }
        return map;
      }, {});
    } catch (error) {
      if (!isMissingImageColumnError(error)) {
        throw error;
      }
    }

    const missingUserIds = uniqueUserIds.filter((spotifyUserId) => !(spotifyUserId in avatarMap));

    if (!missingUserIds.length) {
      return avatarMap;
    }

    return await withAdminAccessToken(async (accessToken) => {
      const profiles = await Promise.allSettled(
        missingUserIds.map(async (spotifyUserId) => {
          const profile = await spotifyRequest<SpotifyUserProfile>(
            `/users/${encodeURIComponent(spotifyUserId)}`,
            accessToken,
          );
          const imageUrl = getPreferredImageUrl(profile);
          try {
            await db.spotifyUser.upsert({
              where: { spotifyUserId },
              update: {
                displayName: profile.display_name,
                imageUrl: imageUrl ?? "",
                profileUrl: profile.external_urls?.spotify ?? null,
              },
              create: {
                spotifyUserId,
                displayName: profile.display_name,
                imageUrl: imageUrl ?? "",
                profileUrl: profile.external_urls?.spotify ?? null,
              },
            });
          } catch (error) {
            if (!isMissingImageColumnError(error)) {
              throw error;
            }

            await db.spotifyUser.upsert({
              where: { spotifyUserId },
              update: {
                displayName: profile.display_name,
                profileUrl: profile.external_urls?.spotify ?? null,
              },
              create: {
                spotifyUserId,
                displayName: profile.display_name,
                profileUrl: profile.external_urls?.spotify ?? null,
              },
            });
          }

          return [spotifyUserId, imageUrl] as const;
        }),
      );

      return profiles.reduce<Record<string, string | null>>((nextAvatarMap, result) => {
        if (result.status === "fulfilled") {
          const [spotifyUserId, imageUrl] = result.value;
          nextAvatarMap[spotifyUserId] = imageUrl;
        }

        return nextAvatarMap;
      }, avatarMap);
    });
  } catch {
    return avatarMap;
  }
}
