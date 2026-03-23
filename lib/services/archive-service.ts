import "server-only";

import { db } from "@/lib/db";
import { addItemsToPlaylist } from "@/lib/spotify/client";
import { withAdminAccessToken } from "@/lib/services/admin-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";

const ARCHIVE_BATCH_SIZE = 100;

export type ArchiveResult = {
  queued: number;
  succeeded: string[];
  failed: string[];
  warnings: string[];
};

export async function seedArchiveEntriesFromPlaylist() {
  const settings = await getOrCreateSettings();
  const existingArchiveTracks = await db.track.findMany({
    where: {
      archiveEntries: {
        some: { playlistSpotifyId: settings.archivePlaylistId },
      },
    },
    select: { spotifyTrackId: true },
  });

  return existingArchiveTracks.map((track) => track.spotifyTrackId);
}

export async function archiveNewTracks(trackIds: string[]) {
  const settings = await getOrCreateSettings();
  const uniqueTrackIds = [...new Set(trackIds)];
  if (!uniqueTrackIds.length) {
    return {
      queued: 0,
      succeeded: [],
      failed: [],
      warnings: [],
    } satisfies ArchiveResult;
  }

  const existingEntries = await db.archiveEntry.findMany({
    where: {
      playlistSpotifyId: settings.archivePlaylistId,
      trackSpotifyId: { in: uniqueTrackIds },
    },
    select: { trackSpotifyId: true },
  });

  const existingSet = new Set(existingEntries.map((entry) => entry.trackSpotifyId));
  const pendingTracks = await db.track.findMany({
    where: {
      spotifyTrackId: {
        in: uniqueTrackIds.filter((trackId) => !existingSet.has(trackId)),
      },
    },
    select: {
      spotifyTrackId: true,
      spotifyUri: true,
    },
  });

  if (!pendingTracks.length) {
    return {
      queued: 0,
      succeeded: [],
      failed: [],
      warnings: [],
    } satisfies ArchiveResult;
  }

  const warnings: string[] = [];
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (let index = 0; index < pendingTracks.length; index += ARCHIVE_BATCH_SIZE) {
    const batch = pendingTracks.slice(index, index + ARCHIVE_BATCH_SIZE);

    try {
      await withAdminAccessToken((accessToken) =>
        addItemsToPlaylist(
          accessToken,
          settings.archivePlaylistId,
          batch.map((track) => track.spotifyUri),
        ),
      );

      await db.archiveEntry.createMany({
        data: batch.map((track) => ({
          playlistSpotifyId: settings.archivePlaylistId,
          trackSpotifyId: track.spotifyTrackId,
        })),
        skipDuplicates: true,
      });

      succeeded.push(...batch.map((track) => track.spotifyTrackId));
    } catch (error) {
      failed.push(...batch.map((track) => track.spotifyTrackId));
      warnings.push(`Archive batch failed for ${batch.length} tracks: ${String(error)}`);
    }
  }

  return {
    queued: pendingTracks.length,
    succeeded,
    failed,
    warnings,
  } satisfies ArchiveResult;
}
