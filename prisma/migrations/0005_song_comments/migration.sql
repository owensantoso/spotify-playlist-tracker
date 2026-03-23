-- CreateEnum
CREATE TYPE "CommentAttachmentKind" AS ENUM ('IMAGE', 'AUDIO');

-- CreateEnum
CREATE TYPE "CommentAttachmentStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CommentModerationState" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateTable
CREATE TABLE "SongComment" (
    "id" TEXT NOT NULL,
    "trackSpotifyId" TEXT NOT NULL,
    "threadRootId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorSpotifyUserId" TEXT NOT NULL,
    "authorDisplayNameSnapshot" TEXT,
    "authorProfileUrlSnapshot" TEXT,
    "authorImageUrlSnapshot" TEXT,
    "clientSubmissionId" TEXT NOT NULL,
    "timestampMs" INTEGER NOT NULL,
    "markerBucketSecond" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "moderationState" "CommentModerationState",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongCommentAttachment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "kind" "CommentAttachmentKind" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "durationMs" INTEGER,
    "status" "CommentAttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongCommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongComment_trackSpotifyId_markerBucketSecond_idx" ON "SongComment"("trackSpotifyId", "markerBucketSecond");

-- CreateIndex
CREATE INDEX "SongComment_trackSpotifyId_timestampMs_idx" ON "SongComment"("trackSpotifyId", "timestampMs");

-- CreateIndex
CREATE INDEX "SongComment_threadRootId_createdAt_idx" ON "SongComment"("threadRootId", "createdAt");

-- CreateIndex
CREATE INDEX "SongComment_parentCommentId_createdAt_idx" ON "SongComment"("parentCommentId", "createdAt");

-- CreateIndex
CREATE INDEX "SongComment_authorSpotifyUserId_createdAt_idx" ON "SongComment"("authorSpotifyUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SongComment_authorSpotifyUserId_clientSubmissionId_key" ON "SongComment"("authorSpotifyUserId", "clientSubmissionId");

-- CreateIndex
CREATE INDEX "SongCommentAttachment_commentId_createdAt_idx" ON "SongCommentAttachment"("commentId", "createdAt");

-- AddForeignKey
ALTER TABLE "SongComment" ADD CONSTRAINT "SongComment_authorSpotifyUserId_fkey" FOREIGN KEY ("authorSpotifyUserId") REFERENCES "SpotifyUser"("spotifyUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongComment" ADD CONSTRAINT "SongComment_threadRootId_fkey" FOREIGN KEY ("threadRootId") REFERENCES "SongComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongComment" ADD CONSTRAINT "SongComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "SongComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongCommentAttachment" ADD CONSTRAINT "SongCommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SongComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
