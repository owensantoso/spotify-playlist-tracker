import "server-only";

import { PlaylistKind, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { addRomanizationToNormalizedTracks } from "@/lib/romanization";
import { getPlaylist, getAllPlaylistItems } from "@/lib/spotify/client";
import { normalizePlaylistItems } from "@/lib/spotify/normalize";
import { getAdminAccount, withAdminAccessToken } from "@/lib/services/admin-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";

export async function validateConfiguredPlaylists() {
  const settings = await getOrCreateSettings();
  const adminAccount = await getAdminAccount();

  return withAdminAccessToken(async (accessToken) => {
    const [mainPlaylist, archivePlaylist] = await Promise.all([
      getPlaylist(accessToken, settings.mainPlaylistId),
      getPlaylist(accessToken, settings.archivePlaylistId),
    ]);

    const now = new Date();

    await Promise.all([
      db.playlist.upsert({
        where: { spotifyPlaylistId: mainPlaylist.id },
        update: {
          name: mainPlaylist.name,
          kind: PlaylistKind.MAIN,
          ownerSpotifyUserId: mainPlaylist.owner.id,
          ownerDisplayName: mainPlaylist.owner.display_name ?? null,
          isPublic: mainPlaylist.public ?? false,
          collaborative: mainPlaylist.collaborative,
          canRead: true,
          canWrite: false,
          snapshotId: mainPlaylist.snapshot_id ?? null,
          lastValidatedAt: now,
        },
        create: {
          spotifyPlaylistId: mainPlaylist.id,
          name: mainPlaylist.name,
          kind: PlaylistKind.MAIN,
          ownerSpotifyUserId: mainPlaylist.owner.id,
          ownerDisplayName: mainPlaylist.owner.display_name ?? null,
          isPublic: mainPlaylist.public ?? false,
          collaborative: mainPlaylist.collaborative,
          canRead: true,
          canWrite: false,
          snapshotId: mainPlaylist.snapshot_id ?? null,
          lastValidatedAt: now,
        },
      }),
      db.playlist.upsert({
        where: { spotifyPlaylistId: archivePlaylist.id },
        update: {
          name: archivePlaylist.name,
          kind: PlaylistKind.ARCHIVE,
          ownerSpotifyUserId: archivePlaylist.owner.id,
          ownerDisplayName: archivePlaylist.owner.display_name ?? null,
          isPublic: archivePlaylist.public ?? false,
          collaborative: archivePlaylist.collaborative,
          canRead: true,
          canWrite:
            archivePlaylist.owner.id === adminAccount?.spotifyUserId ||
            archivePlaylist.collaborative,
          snapshotId: archivePlaylist.snapshot_id ?? null,
          lastValidatedAt: now,
        },
        create: {
          spotifyPlaylistId: archivePlaylist.id,
          name: archivePlaylist.name,
          kind: PlaylistKind.ARCHIVE,
          ownerSpotifyUserId: archivePlaylist.owner.id,
          ownerDisplayName: archivePlaylist.owner.display_name ?? null,
          isPublic: archivePlaylist.public ?? false,
          collaborative: archivePlaylist.collaborative,
          canRead: true,
          canWrite:
            archivePlaylist.owner.id === adminAccount?.spotifyUserId ||
            archivePlaylist.collaborative,
          snapshotId: archivePlaylist.snapshot_id ?? null,
          lastValidatedAt: now,
        },
      }),
    ]);

    return {
      mainPlaylist,
      archivePlaylist,
      canWriteArchive:
        archivePlaylist.owner.id === adminAccount?.spotifyUserId || archivePlaylist.collaborative,
    };
  });
}

export async function seedArchiveEntriesFromRemoteArchive() {
  const settings = await getOrCreateSettings();

  return withAdminAccessToken(async (accessToken) => {
    const items = await getAllPlaylistItems(accessToken, settings.archivePlaylistId);
    const { normalized: baseNormalized } = normalizePlaylistItems(items);
    const normalized = await addRomanizationToNormalizedTracks(baseNormalized);

    await Promise.all(
      normalized.map((track) =>
        (db as PrismaClient).track.upsert({
          where: { spotifyTrackId: track.trackId },
          update: {
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
          },
          create: {
            spotifyTrackId: track.trackId,
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
          },
        }),
      ),
    );

    await db.$transaction(async (tx) => {
      await tx.archiveEntry.createMany({
        data: normalized.map((track) => ({
          playlistSpotifyId: settings.archivePlaylistId,
          trackSpotifyId: track.trackId,
        })),
        skipDuplicates: true,
      });
    }, {
      timeout: 20000,
    });

    return normalized.length;
  });
}
