import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { SpotifyUserProfile } from "@/lib/spotify/types";

function isMissingImageColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function upsertSpotifyUserProfile(profile: SpotifyUserProfile) {
  try {
    await db.spotifyUser.upsert({
      where: { spotifyUserId: profile.id },
      update: {
        displayName: profile.display_name,
        imageUrl: profile.images?.[0]?.url ?? "",
        profileUrl: profile.external_urls?.spotify ?? null,
      },
      create: {
        spotifyUserId: profile.id,
        displayName: profile.display_name,
        imageUrl: profile.images?.[0]?.url ?? "",
        profileUrl: profile.external_urls?.spotify ?? null,
      },
    });
  } catch (error) {
    if (!isMissingImageColumnError(error)) {
      throw error;
    }

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
}
