CREATE TYPE "SongReactionKind" AS ENUM ('LIKE', 'SUPERLIKE');

CREATE TABLE "SongReaction" (
    "id" TEXT NOT NULL,
    "trackSpotifyId" TEXT NOT NULL,
    "spotifyUserId" TEXT NOT NULL,
    "kind" "SongReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SongReaction_trackSpotifyId_spotifyUserId_key" ON "SongReaction"("trackSpotifyId", "spotifyUserId");
CREATE INDEX "SongReaction_trackSpotifyId_kind_idx" ON "SongReaction"("trackSpotifyId", "kind");
CREATE INDEX "SongReaction_spotifyUserId_createdAt_idx" ON "SongReaction"("spotifyUserId", "createdAt");

ALTER TABLE "SongReaction" ADD CONSTRAINT "SongReaction_trackSpotifyId_fkey" FOREIGN KEY ("trackSpotifyId") REFERENCES "Track"("spotifyTrackId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SongReaction" ADD CONSTRAINT "SongReaction_spotifyUserId_fkey" FOREIGN KEY ("spotifyUserId") REFERENCES "SpotifyUser"("spotifyUserId") ON DELETE CASCADE ON UPDATE CASCADE;
