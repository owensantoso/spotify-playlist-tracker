import "server-only";

import {
  LifecycleStatus,
  PlaylistKind,
  Prisma,
  PrismaClient,
  SyncRunStatus,
  type SyncTriggerSource,
} from "@prisma/client";

import { db } from "@/lib/db";
import { addRomanizationToNormalizedTracks } from "@/lib/romanization";
import { getAllPlaylistItems, getPlaylist } from "@/lib/spotify/client";
import { normalizePlaylistItems } from "@/lib/spotify/normalize";
import type { NormalizedPlaylistTrack } from "@/lib/spotify/types";
import { archiveNewTracks } from "@/lib/services/archive-service";
import { getAdminAccount, withAdminAccessToken } from "@/lib/services/admin-service";
import { sendAdditionNotifications } from "@/lib/services/notification-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { reconcileLifecycles } from "@/lib/sync/reconcile";

type PersistedSyncArtifacts = {
  syncRunId: string;
  warnings: string[];
  createdTracks: NormalizedPlaylistTrack[];
  removalsCount: number;
};

type SyncDebugItem = {
  added_at: string | null;
  added_by: {
    id: string | null;
    display_name: string | null;
    spotify: string | null;
  } | null;
  track: {
    id: string | null;
    name: string | null;
    artists: Array<{ id: string | null; name: string }>;
    spotify: string | null;
  } | null;
};

type SyncDebugPayload = {
  unknownContributorCount: number;
  unknownContributorSample: SyncDebugItem[];
  knownContributorSample: SyncDebugItem[];
};

type TrackCatalogRecord = {
  spotifyTrackId: string;
  name: string;
  nameRomanized: string | null;
  artistNames: string[];
  artistNamesRomanized: string[];
  artistSpotifyUrls: string[];
  albumName: string | null;
  artworkUrl: string | null;
  spotifyUrl: string;
  spotifyUri: string;
  durationMs: number | null;
  explicit: boolean | null;
};

type ContributorRecord = {
  spotifyUserId: string;
  displayName: string | null;
  profileUrl: string | null;
};

function toSyncDebugItem(item: Awaited<ReturnType<typeof getAllPlaylistItems>>[number]): SyncDebugItem {
  const track =
    item.track && item.track.type === "track" && "id" in item.track ? item.track : null;

  return {
    added_at: item.added_at,
    added_by: item.added_by
      ? {
          id: item.added_by.id,
          display_name: item.added_by.display_name,
          spotify: item.added_by.external_urls?.spotify ?? null,
        }
      : null,
    track:
      track
        ? {
            id: track.id,
            name: track.name,
            artists: track.artists?.map((artist) => ({
              id: artist.id,
              name: artist.name,
            })) ?? [],
            spotify: track.external_urls?.spotify ?? null,
          }
        : null,
  };
}

function buildSyncDebugPayload(rawItems: Awaited<ReturnType<typeof getAllPlaylistItems>>): SyncDebugPayload {
  const unknownContributorItems = rawItems.filter((item) => !item.added_by);
  const knownContributorItems = rawItems.filter((item) => item.added_by);

  return {
    unknownContributorCount: unknownContributorItems.length,
    unknownContributorSample: unknownContributorItems.slice(0, 3).map(toSyncDebugItem),
    knownContributorSample: knownContributorItems.slice(0, 2).map(toSyncDebugItem),
  };
}

async function upsertPlaylistMetadata(
  tx: Prisma.TransactionClient | PrismaClient,
  playlist: Awaited<ReturnType<typeof getPlaylist>>,
  kind: PlaylistKind,
  canWrite: boolean,
) {
  await tx.playlist.upsert({
    where: { spotifyPlaylistId: playlist.id },
    update: {
      name: playlist.name,
      kind,
      ownerSpotifyUserId: playlist.owner.id,
      ownerDisplayName: playlist.owner.display_name ?? null,
      isPublic: playlist.public ?? false,
      collaborative: playlist.collaborative,
      canRead: true,
      canWrite,
      snapshotId: playlist.snapshot_id ?? null,
      lastValidatedAt: new Date(),
    },
    create: {
      spotifyPlaylistId: playlist.id,
      name: playlist.name,
      kind,
      ownerSpotifyUserId: playlist.owner.id,
      ownerDisplayName: playlist.owner.display_name ?? null,
      isPublic: playlist.public ?? false,
      collaborative: playlist.collaborative,
      canRead: true,
      canWrite,
      snapshotId: playlist.snapshot_id ?? null,
      lastValidatedAt: new Date(),
    },
  });
}

async function upsertNormalizedCatalog(
  tx: Prisma.TransactionClient | PrismaClient,
  tracks: NormalizedPlaylistTrack[],
) {
  const contributors = new Map<string, { displayName: string | null; profileUrl: string | null }>();

  for (const track of tracks) {
    if (track.addedBySpotifyUserId) {
      contributors.set(track.addedBySpotifyUserId, {
        displayName: track.addedByDisplayName ?? track.addedBySpotifyUserId,
        profileUrl: track.addedByProfileUrl,
      });
    }
  }

  const trackIds = [...new Set(tracks.map((track) => track.trackId))];
  const contributorIds = [...contributors.keys()];

  const [existingTracks, existingContributors] = await Promise.all([
    trackIds.length
      ? tx.track.findMany({
          where: {
            spotifyTrackId: {
              in: trackIds,
            },
          },
          select: {
            spotifyTrackId: true,
            name: true,
            nameRomanized: true,
            artistNames: true,
            artistNamesRomanized: true,
            artistSpotifyUrls: true,
            albumName: true,
            artworkUrl: true,
            spotifyUrl: true,
            spotifyUri: true,
            durationMs: true,
            explicit: true,
          },
        })
      : Promise.resolve([]),
    contributorIds.length
      ? tx.spotifyUser.findMany({
          where: {
            spotifyUserId: {
              in: contributorIds,
            },
          },
          select: {
            spotifyUserId: true,
            displayName: true,
            profileUrl: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const existingTracksById = new Map(
    existingTracks.map((track) => [track.spotifyTrackId, track] satisfies [string, TrackCatalogRecord]),
  );
  const existingContributorsById = new Map(
    existingContributors.map(
      (contributor) => [contributor.spotifyUserId, contributor] satisfies [string, ContributorRecord],
    ),
  );

  const tracksToCreate: Prisma.TrackCreateManyInput[] = [];
  const trackUpdates: Array<Promise<unknown>> = [];

  for (const track of tracks) {
    const nextValues = {
      name: track.trackName,
      nameRomanized: track.trackNameRomanized,
      artistNames: track.artistNames,
      artistNamesRomanized: track.artistNamesRomanized,
      artistSpotifyUrls: track.artistSpotifyUrls,
      albumName: track.albumName,
      artworkUrl: track.artworkUrl,
      spotifyUrl: track.spotifyUrl,
      spotifyUri: track.spotifyUri,
      durationMs: track.durationMs,
      explicit: track.explicit,
    } satisfies Omit<Prisma.TrackCreateManyInput, "spotifyTrackId">;
    const existing = existingTracksById.get(track.trackId);

    if (!existing) {
      tracksToCreate.push({
        spotifyTrackId: track.trackId,
        ...nextValues,
      });
      continue;
    }

    const changed =
      existing.name !== nextValues.name ||
      existing.nameRomanized !== nextValues.nameRomanized ||
      JSON.stringify(existing.artistNames) !== JSON.stringify(nextValues.artistNames) ||
      JSON.stringify(existing.artistNamesRomanized) !== JSON.stringify(nextValues.artistNamesRomanized) ||
      JSON.stringify(existing.artistSpotifyUrls) !== JSON.stringify(nextValues.artistSpotifyUrls) ||
      existing.albumName !== nextValues.albumName ||
      existing.artworkUrl !== nextValues.artworkUrl ||
      existing.spotifyUrl !== nextValues.spotifyUrl ||
      existing.spotifyUri !== nextValues.spotifyUri ||
      existing.durationMs !== nextValues.durationMs ||
      existing.explicit !== nextValues.explicit;

    if (!changed) {
      continue;
    }

    trackUpdates.push(
      tx.track.update({
        where: { spotifyTrackId: track.trackId },
        data: nextValues,
      }),
    );
  }

  const contributorsToCreate: Prisma.SpotifyUserCreateManyInput[] = [];
  const contributorUpdates: Array<Promise<unknown>> = [];

  for (const [spotifyUserId, contributor] of contributors.entries()) {
    const existing = existingContributorsById.get(spotifyUserId);
    const nextValues = {
      displayName: contributor.displayName,
      profileUrl: contributor.profileUrl,
    } satisfies Omit<Prisma.SpotifyUserCreateManyInput, "spotifyUserId">;

    if (!existing) {
      contributorsToCreate.push({
        spotifyUserId,
        ...nextValues,
      });
      continue;
    }

    if (
      existing.displayName === nextValues.displayName &&
      existing.profileUrl === nextValues.profileUrl
    ) {
      continue;
    }

    contributorUpdates.push(
      tx.spotifyUser.update({
        where: { spotifyUserId },
        data: nextValues,
      }),
    );
  }

  await Promise.all([
    tracksToCreate.length
      ? tx.track.createMany({
          data: tracksToCreate,
          skipDuplicates: true,
        })
      : Promise.resolve(),
    contributorsToCreate.length
      ? tx.spotifyUser.createMany({
          data: contributorsToCreate,
          skipDuplicates: true,
        })
      : Promise.resolve(),
    ...trackUpdates,
    ...contributorUpdates,
  ]);
}

export async function runSync(triggerSource: SyncTriggerSource) {
  const settings = await getOrCreateSettings();
  const adminAccount = await getAdminAccount();
  const startedAt = new Date();

  try {
    const { mainPlaylist, archivePlaylist, rawItems } = await withAdminAccessToken(async (accessToken) => {
      const [mainPlaylist, archivePlaylist, rawItems] = await Promise.all([
        getPlaylist(accessToken, settings.mainPlaylistId),
        getPlaylist(accessToken, settings.archivePlaylistId),
        getAllPlaylistItems(accessToken, settings.mainPlaylistId),
      ]);

      return { mainPlaylist, archivePlaylist, rawItems };
    });

    const { normalized: baseNormalized, warnings: normalizationWarnings } = normalizePlaylistItems(rawItems);
    const normalized = await addRomanizationToNormalizedTracks(baseNormalized);
    const debug = buildSyncDebugPayload(rawItems);
    await upsertNormalizedCatalog(db, normalized);

    const syncArtifacts = await db.$transaction(async (tx) => {
      await Promise.all([
        upsertPlaylistMetadata(tx, mainPlaylist, PlaylistKind.MAIN, false),
        upsertPlaylistMetadata(
          tx,
          archivePlaylist,
          PlaylistKind.ARCHIVE,
          archivePlaylist.owner.id === adminAccount?.spotifyUserId || archivePlaylist.collaborative,
        ),
      ]);

      const existingActiveLifecycles = await tx.trackLifecycle.findMany({
        where: {
          playlistSpotifyId: settings.mainPlaylistId,
          status: LifecycleStatus.ACTIVE,
        },
        select: {
          id: true,
          matchFingerprint: true,
          occurrenceOrdinal: true,
          status: true,
        },
      });

      const reconciliation = reconcileLifecycles(normalized, existingActiveLifecycles);
      const allWarnings = [...normalizationWarnings, ...reconciliation.warnings];

      if (reconciliation.matchedLifecycleIds.length > 0) {
        await tx.trackLifecycle.updateMany({
          where: { id: { in: reconciliation.matchedLifecycleIds } },
          data: { lastSeenAt: startedAt },
        });
      }

      if (reconciliation.lifecyclesToRemove.length > 0) {
        await tx.trackLifecycle.updateMany({
          where: { id: { in: reconciliation.lifecyclesToRemove } },
          data: {
            status: LifecycleStatus.REMOVED,
            removedObservedAt: startedAt,
            lastSeenAt: startedAt,
          },
        });
      }

      if (reconciliation.lifecyclesToCreate.length > 0) {
        await tx.trackLifecycle.createMany({
          data: reconciliation.lifecyclesToCreate.map((lifecycle) => ({
            playlistSpotifyId: settings.mainPlaylistId,
            trackSpotifyId: lifecycle.trackId,
            addedBySpotifyUserId: lifecycle.addedBySpotifyUserId,
            spotifyAddedAt: lifecycle.addedAt,
            firstSeenAt: startedAt,
            lastSeenAt: startedAt,
            status: LifecycleStatus.ACTIVE,
            matchFingerprint: lifecycle.matchFingerprint,
            occurrenceOrdinal: lifecycle.occurrenceOrdinal,
          })),
        });
      }

      const syncRun = await tx.syncRun.create({
        data: {
          triggerSource,
          status: SyncRunStatus.RUNNING,
          playlistSpotifyId: settings.mainPlaylistId,
          startedAt,
          fetchedItemsCount: rawItems.length,
          activeItemsCount: normalized.length,
          additionsCount: reconciliation.lifecyclesToCreate.length,
          removalsCount: reconciliation.lifecyclesToRemove.length,
          warnings: allWarnings,
          errors: [],
        },
      });

      return {
        syncRunId: syncRun.id,
        warnings: allWarnings,
        createdTracks: reconciliation.lifecyclesToCreate,
        removalsCount: reconciliation.lifecyclesToRemove.length,
      } satisfies PersistedSyncArtifacts;
    }, {
      timeout: 20000,
    });

    const archiveResult = await archiveNewTracks(syncArtifacts.createdTracks.map((track) => track.trackId));
    const notificationResult = await sendAdditionNotifications({
      lifecycles: syncArtifacts.createdTracks.map((track) => ({
        trackSpotifyId: track.trackId,
        trackName: track.trackName,
        artistNames: track.artistNames,
        spotifyUrl: track.spotifyUrl,
        addedByDisplayName: track.addedByDisplayName,
        addedBySpotifyUserId: track.addedBySpotifyUserId,
      })),
    });

    const errors = [...archiveResult.warnings, ...notificationResult.warnings];
    const status =
      errors.length > 0 ? SyncRunStatus.PARTIAL : SyncRunStatus.SUCCESS;

    await db.syncRun.update({
      where: { id: syncArtifacts.syncRunId },
      data: {
        status,
        completedAt: new Date(),
        archiveQueuedCount: archiveResult.queued,
        archiveSuccessCount: archiveResult.succeeded.length,
        archiveFailureCount: archiveResult.failed.length,
        notificationSuccessCount: notificationResult.sentCount,
        notificationFailureCount: notificationResult.failedCount,
        warnings: [...syncArtifacts.warnings, ...errors],
      },
    });

    return {
      ok: true,
      syncRunId: syncArtifacts.syncRunId,
      additionsCount: syncArtifacts.createdTracks.length,
      removalsCount: syncArtifacts.removalsCount,
      archiveResult,
      notificationResult,
      warnings: [...syncArtifacts.warnings, ...errors],
      debug,
    };
  } catch (error) {
    const failedRun = await db.syncRun.create({
      data: {
        triggerSource,
        status: SyncRunStatus.FAILED,
        playlistSpotifyId: settings.mainPlaylistId,
        startedAt,
        completedAt: new Date(),
        warnings: [],
        errors: [String(error)],
      },
    });

    return {
      ok: false,
      syncRunId: failedRun.id,
      error: String(error),
    };
  }
}
