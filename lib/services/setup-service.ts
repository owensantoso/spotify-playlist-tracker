import "server-only";

import { PlaylistKind, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { addRomanizationToNormalizedTracks, romanizeText } from "@/lib/romanization";
import { getPlaylist, getAllPlaylistItems } from "@/lib/spotify/client";
import { normalizePlaylistItems } from "@/lib/spotify/normalize";
import { getAdminAccount, withAdminAccessToken } from "@/lib/services/admin-service";
import { getOrCreateSettings } from "@/lib/services/settings-service";

export type ConfiguredPlaylistValidation = {
  mainPlaylist: {
    name: string;
  };
  archivePlaylist: {
    name: string;
  };
  canWriteArchive: boolean;
};

function toConfiguredPlaylistValidation(input: {
  mainPlaylist: { name: string };
  archivePlaylist: { name: string };
  canWriteArchive: boolean;
}): ConfiguredPlaylistValidation {
  return {
    mainPlaylist: {
      name: input.mainPlaylist.name,
    },
    archivePlaylist: {
      name: input.archivePlaylist.name,
    },
    canWriteArchive: input.canWriteArchive,
  };
}

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

    return toConfiguredPlaylistValidation({
      mainPlaylist,
      archivePlaylist,
      canWriteArchive:
        archivePlaylist.owner.id === adminAccount?.spotifyUserId || archivePlaylist.collaborative,
    });
  });
}

export async function getConfiguredPlaylistsValidation(options: { maxAgeMs?: number } = {}) {
  const settings = await getOrCreateSettings();
  const maxAgeMs = options.maxAgeMs ?? 15 * 60 * 1000;
  const playlists = await db.playlist.findMany({
    where: {
      spotifyPlaylistId: {
        in: [settings.mainPlaylistId, settings.archivePlaylistId],
      },
    },
    select: {
      spotifyPlaylistId: true,
      name: true,
      canWrite: true,
      lastValidatedAt: true,
    },
  });

  const mainPlaylist = playlists.find(
    (playlist) => playlist.spotifyPlaylistId === settings.mainPlaylistId,
  );
  const archivePlaylist = playlists.find(
    (playlist) => playlist.spotifyPlaylistId === settings.archivePlaylistId,
  );
  const now = Date.now();
  const recentlyValidated =
    mainPlaylist?.lastValidatedAt &&
    archivePlaylist?.lastValidatedAt &&
    now - mainPlaylist.lastValidatedAt.getTime() <= maxAgeMs &&
    now - archivePlaylist.lastValidatedAt.getTime() <= maxAgeMs;

  if (mainPlaylist && archivePlaylist && recentlyValidated) {
    return toConfiguredPlaylistValidation({
      mainPlaylist,
      archivePlaylist,
      canWriteArchive: archivePlaylist.canWrite,
    });
  }

  return validateConfiguredPlaylists();
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

export async function reparseTrackRomanization() {
  const tracks = await db.track.findMany({
    select: {
      spotifyTrackId: true,
      name: true,
      artistNames: true,
    },
  });

  await Promise.all(
    tracks.map(async (track) => {
      const [nameRomanized, artistNamesRomanized] = await Promise.all([
        romanizeText(track.name),
        Promise.all(track.artistNames.map(async (artist) => (await romanizeText(artist)) ?? artist)),
      ]);

      await db.track.update({
        where: { spotifyTrackId: track.spotifyTrackId },
        data: {
          nameRomanized,
          artistNamesRomanized,
        },
      });
    }),
  );

  return tracks.length;
}
