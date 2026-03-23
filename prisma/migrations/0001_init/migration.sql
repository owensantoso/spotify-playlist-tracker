-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlaylistKind" AS ENUM ('MAIN', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncTriggerSource" AS ENUM ('MANUAL', 'GITHUB_ACTIONS', 'CRON', 'SETUP');

-- CreateTable
CREATE TABLE "AdminAccount" (
    "spotifyUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "grantedScopes" TEXT[],
    "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("spotifyUserId")
);

-- CreateTable
CREATE TABLE "SpotifyUser" (
    "spotifyUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyUser_pkey" PRIMARY KEY ("spotifyUserId")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "spotifyPlaylistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PlaylistKind" NOT NULL,
    "ownerSpotifyUserId" TEXT,
    "ownerDisplayName" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "collaborative" BOOLEAN NOT NULL DEFAULT false,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "snapshotId" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("spotifyPlaylistId")
);

-- CreateTable
CREATE TABLE "Track" (
    "spotifyTrackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artistNames" TEXT[],
    "albumName" TEXT,
    "artworkUrl" TEXT,
    "spotifyUrl" TEXT NOT NULL,
    "spotifyUri" TEXT NOT NULL,
    "durationMs" INTEGER,
    "explicit" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("spotifyTrackId")
);

-- CreateTable
CREATE TABLE "TrackLifecycle" (
    "id" TEXT NOT NULL,
    "playlistSpotifyId" TEXT NOT NULL,
    "trackSpotifyId" TEXT NOT NULL,
    "addedBySpotifyUserId" TEXT,
    "spotifyAddedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "removedObservedAt" TIMESTAMP(3),
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "matchFingerprint" TEXT NOT NULL,
    "occurrenceOrdinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackLifecycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveEntry" (
    "playlistSpotifyId" TEXT NOT NULL,
    "trackSpotifyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveEntry_pkey" PRIMARY KEY ("playlistSpotifyId","trackSpotifyId")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "triggerSource" "SyncTriggerSource" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "playlistSpotifyId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "fetchedItemsCount" INTEGER NOT NULL DEFAULT 0,
    "activeItemsCount" INTEGER NOT NULL DEFAULT 0,
    "additionsCount" INTEGER NOT NULL DEFAULT 0,
    "removalsCount" INTEGER NOT NULL DEFAULT 0,
    "archiveQueuedCount" INTEGER NOT NULL DEFAULT 0,
    "archiveSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "archiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "notificationSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "notificationFailureCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT[],
    "errors" TEXT[],

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mainPlaylistId" TEXT NOT NULL,
    "archivePlaylistId" TEXT NOT NULL,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "discordWebhookUrl" TEXT,
    "notifyOnAdditions" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnRemovals" BOOLEAN NOT NULL DEFAULT false,
    "batchedNotifications" BOOLEAN NOT NULL DEFAULT true,
    "archiveDedupeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicDashboard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackLifecycle_playlistSpotifyId_status_idx" ON "TrackLifecycle"("playlistSpotifyId", "status");

-- CreateIndex
CREATE INDEX "TrackLifecycle_playlistSpotifyId_matchFingerprint_occurrenc_idx" ON "TrackLifecycle"("playlistSpotifyId", "matchFingerprint", "occurrenceOrdinal");

-- CreateIndex
CREATE INDEX "TrackLifecycle_trackSpotifyId_status_idx" ON "TrackLifecycle"("trackSpotifyId", "status");

-- AddForeignKey
ALTER TABLE "TrackLifecycle" ADD CONSTRAINT "TrackLifecycle_playlistSpotifyId_fkey" FOREIGN KEY ("playlistSpotifyId") REFERENCES "Playlist"("spotifyPlaylistId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackLifecycle" ADD CONSTRAINT "TrackLifecycle_trackSpotifyId_fkey" FOREIGN KEY ("trackSpotifyId") REFERENCES "Track"("spotifyTrackId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackLifecycle" ADD CONSTRAINT "TrackLifecycle_addedBySpotifyUserId_fkey" FOREIGN KEY ("addedBySpotifyUserId") REFERENCES "SpotifyUser"("spotifyUserId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveEntry" ADD CONSTRAINT "ArchiveEntry_playlistSpotifyId_fkey" FOREIGN KEY ("playlistSpotifyId") REFERENCES "Playlist"("spotifyPlaylistId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveEntry" ADD CONSTRAINT "ArchiveEntry_trackSpotifyId_fkey" FOREIGN KEY ("trackSpotifyId") REFERENCES "Track"("spotifyTrackId") ON DELETE CASCADE ON UPDATE CASCADE;
