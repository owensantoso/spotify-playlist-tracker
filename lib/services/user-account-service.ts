import "server-only";

import { db } from "@/lib/db";
import type { SpotifyUserProfile } from "@/lib/spotify/types";

export async function upsertSpotifyUserProfile(profile: SpotifyUserProfile) {
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
