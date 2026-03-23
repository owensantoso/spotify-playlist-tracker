import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getViewerSession } from "@/lib/session";
import { getCurrentUser, getPlaybackState } from "@/lib/spotify/client";
import type { SpotifyTrack } from "@/lib/spotify/types";
import { withViewerSpotifyAccessToken } from "@/lib/services/now-playing-service";
import { upsertSpotifyUserProfile } from "@/lib/services/user-account-service";

const MAX_COMMENT_LENGTH = 600;
const PLAYBACK_DRIFT_TOLERANCE_MS = 2_500;

export class CommentFeatureUnavailableError extends Error {}
export class CommentUnauthorizedError extends Error {}
export class CommentPlaybackMismatchError extends Error {
  constructor(
    message: string,
    public code: "TRACK_CHANGED" | "PROGRESS_DRIFT" | "NO_ACTIVE_PLAYBACK",
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export class CommentValidationError extends Error {}

type MarkerAuthor = {
  spotifyUserId: string;
  displayName: string | null;
  imageUrl: string | null;
  profileUrl: string | null;
};

export type CommentMarker = {
  markerBucketSecond: number;
  timestampMsRepresentative: number;
  commentCount: number;
  threadCount: number;
  authors: MarkerAuthor[];
  previewComment: string;
  topLevelCommentIds: string[];
};

export type CommentThread = {
  id: string;
  trackSpotifyId: string;
  threadRootId: string;
  parentCommentId: string | null;
  timestampMs: number;
  markerBucketSecond: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: MarkerAuthor;
  replies: CommentThread[];
};

type ReadResult<T> = {
  featureAvailable: boolean;
  version: string;
  data: T;
};

type SpotifyPlayableTrack = SpotifyTrack & {
  id: string;
};

function isCommentFeatureUnavailableError(error: unknown) {
  return (
    error instanceof CommentFeatureUnavailableError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022"))
  );
}

function normalizeBody(body: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new CommentValidationError("Comment text is required.");
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new CommentValidationError(`Comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
  }

  return trimmed;
}

function isPlayableTrack(
  track: SpotifyTrack | { type: string } | null | undefined,
): track is SpotifyPlayableTrack {
  return Boolean(track && track.type === "track" && "id" in track && track.id);
}

function computeVersion(updatedAtValues: Date[]) {
  const newest = updatedAtValues.reduce<Date | null>((latest, current) => {
    if (!latest || current > latest) {
      return current;
    }
    return latest;
  }, null);

  return newest?.toISOString() ?? "0";
}

function mapAuthor(comment: {
  authorSpotifyUserId: string;
  authorDisplayNameSnapshot: string | null;
  authorImageUrlSnapshot: string | null;
  authorProfileUrlSnapshot: string | null;
}): MarkerAuthor {
  return {
    spotifyUserId: comment.authorSpotifyUserId,
    displayName: comment.authorDisplayNameSnapshot,
    imageUrl: comment.authorImageUrlSnapshot,
    profileUrl: comment.authorProfileUrlSnapshot,
  };
}

async function ensureCommentTables<T>(callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    if (isCommentFeatureUnavailableError(error)) {
      throw new CommentFeatureUnavailableError("Comments feature is unavailable.");
    }
    throw error;
  }
}

export async function getCommentMarkers(trackSpotifyId: string): Promise<ReadResult<CommentMarker[]>> {
  try {
    return await ensureCommentTables(async () => {
      const comments = await db.songComment.findMany({
        where: {
          trackSpotifyId,
          parentCommentId: null,
          deletedAt: null,
        },
        orderBy: [{ markerBucketSecond: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          markerBucketSecond: true,
          timestampMs: true,
          body: true,
          updatedAt: true,
          createdAt: true,
          authorSpotifyUserId: true,
          authorDisplayNameSnapshot: true,
          authorImageUrlSnapshot: true,
          authorProfileUrlSnapshot: true,
        },
      });

      const grouped = new Map<number, typeof comments>();
      for (const comment of comments) {
        const group = grouped.get(comment.markerBucketSecond) ?? [];
        group.push(comment);
        grouped.set(comment.markerBucketSecond, group);
      }

      const markers = [...grouped.entries()].map(([bucket, group]) => {
        const sortedByCreated = [...group].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        const preview = sortedByCreated[0];
        const uniqueAuthors = new Map<string, MarkerAuthor>();
        for (const comment of sortedByCreated) {
          if (!uniqueAuthors.has(comment.authorSpotifyUserId) && uniqueAuthors.size < 3) {
            uniqueAuthors.set(comment.authorSpotifyUserId, mapAuthor(comment));
          }
        }

        return {
          markerBucketSecond: bucket,
          timestampMsRepresentative: Math.min(...group.map((comment) => comment.timestampMs)),
          commentCount: group.length,
          threadCount: group.length,
          authors: [...uniqueAuthors.values()],
          previewComment: preview.body,
          topLevelCommentIds: group.map((comment) => comment.id),
        } satisfies CommentMarker;
      });

      return {
        featureAvailable: true,
        version: computeVersion(comments.map((comment) => comment.updatedAt)),
        data: markers,
      };
    });
  } catch (error) {
    if (isCommentFeatureUnavailableError(error)) {
      return {
        featureAvailable: false,
        version: "0",
        data: [],
      };
    }
    throw error;
  }
}

export async function getCommentThreads(trackSpotifyId: string): Promise<ReadResult<CommentThread[]>> {
  try {
    return await ensureCommentTables(async () => {
      const comments = await db.songComment.findMany({
        where: {
          trackSpotifyId,
          deletedAt: null,
        },
        orderBy: [{ timestampMs: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          trackSpotifyId: true,
          threadRootId: true,
          parentCommentId: true,
          timestampMs: true,
          markerBucketSecond: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          authorSpotifyUserId: true,
          authorDisplayNameSnapshot: true,
          authorImageUrlSnapshot: true,
          authorProfileUrlSnapshot: true,
        },
      });

      const nodes = new Map<string, CommentThread>();
      for (const comment of comments) {
        nodes.set(comment.id, {
          id: comment.id,
          trackSpotifyId: comment.trackSpotifyId,
          threadRootId: comment.threadRootId,
          parentCommentId: comment.parentCommentId,
          timestampMs: comment.timestampMs,
          markerBucketSecond: comment.markerBucketSecond,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          author: mapAuthor(comment),
          replies: [],
        });
      }

      const roots: CommentThread[] = [];
      for (const node of nodes.values()) {
        if (node.parentCommentId) {
          const parent = nodes.get(node.parentCommentId);
          if (parent) {
            parent.replies.push(node);
          }
          continue;
        }
        roots.push(node);
      }

      return {
        featureAvailable: true,
        version: computeVersion(comments.map((comment) => comment.updatedAt)),
        data: roots,
      };
    });
  } catch (error) {
    if (isCommentFeatureUnavailableError(error)) {
      return {
        featureAvailable: false,
        version: "0",
        data: [],
      };
    }
    throw error;
  }
}

export async function getCommentCountMap(trackSpotifyIds: Array<string | null | undefined>) {
  const uniqueTrackIds = [...new Set(trackSpotifyIds.filter((value): value is string => Boolean(value?.trim())))];
  if (!uniqueTrackIds.length) {
    return {};
  }

  try {
    return await ensureCommentTables(async () => {
      const grouped = await db.songComment.groupBy({
        by: ["trackSpotifyId"],
        where: {
          trackSpotifyId: {
            in: uniqueTrackIds,
          },
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      });

      return grouped.reduce<Record<string, number>>((counts, row) => {
        counts[row.trackSpotifyId] = row._count._all;
        return counts;
      }, {});
    });
  } catch (error) {
    if (isCommentFeatureUnavailableError(error)) {
      return {};
    }

    throw error;
  }
}

export async function createTopLevelComment(input: {
  expectedTrackId: string;
  expectedProgressMs: number;
  capturedAt: number;
  body: string;
  clientSubmissionId: string;
}) {
  const viewerSession = await getViewerSession();
  if (!viewerSession?.spotifyUserId) {
    throw new CommentUnauthorizedError("Viewer sign-in is required.");
  }

  const normalizedBody = normalizeBody(input.body);

  try {
    return await ensureCommentTables(async () =>
      withViewerSpotifyAccessToken(async (accessToken, auth, refreshedViewerSession) => {
        const [playback, profile] = await Promise.all([
          getPlaybackState(accessToken),
          getCurrentUser(accessToken).catch(() => null),
        ]);

        if (!isPlayableTrack(playback?.item)) {
          throw new CommentPlaybackMismatchError(
            "No active playback is available.",
            "NO_ACTIVE_PLAYBACK",
          );
        }

        const playbackTrack = playback.item;

        if (playbackTrack.id !== input.expectedTrackId) {
          throw new CommentPlaybackMismatchError(
            "Playback moved to a different track.",
            "TRACK_CHANGED",
            { currentTrackId: playbackTrack.id },
          );
        }

        const expectedProgress = Number.isFinite(input.expectedProgressMs)
          ? Math.max(0, input.expectedProgressMs)
          : 0;
        const capturedAt = Number.isFinite(input.capturedAt) ? input.capturedAt : Date.now();
        const networkDriftAllowance = Math.max(0, Date.now() - capturedAt);
        const driftTolerance = Math.max(PLAYBACK_DRIFT_TOLERANCE_MS, networkDriftAllowance);
        const liveProgress = Math.max(0, playback.progress_ms ?? 0);

        if (Math.abs(liveProgress - expectedProgress) > driftTolerance) {
          throw new CommentPlaybackMismatchError(
            "Playback drift exceeded the accepted tolerance.",
            "PROGRESS_DRIFT",
            { currentProgressMs: liveProgress },
          );
        }

        if (profile) {
          await upsertSpotifyUserProfile(profile);
        }

        const id = crypto.randomUUID();
        const markerBucketSecond = Math.floor(liveProgress / 1000);

        const comment = await db.$transaction(async (tx) => {
          const created = await tx.songComment.create({
            data: {
              id,
              trackSpotifyId: playbackTrack.id,
              threadRootId: id,
              parentCommentId: null,
              authorSpotifyUserId: auth.spotifyUserId,
              authorDisplayNameSnapshot: profile?.display_name ?? null,
              authorProfileUrlSnapshot: profile?.external_urls?.spotify ?? null,
              authorImageUrlSnapshot: profile?.images?.[0]?.url ?? null,
              clientSubmissionId: input.clientSubmissionId,
              timestampMs: liveProgress,
              markerBucketSecond,
              body: normalizedBody,
              moderationState: "VISIBLE",
            },
            select: {
              id: true,
              trackSpotifyId: true,
              threadRootId: true,
              parentCommentId: true,
              timestampMs: true,
              markerBucketSecond: true,
              body: true,
              createdAt: true,
              updatedAt: true,
              authorSpotifyUserId: true,
              authorDisplayNameSnapshot: true,
              authorImageUrlSnapshot: true,
              authorProfileUrlSnapshot: true,
            },
          });

          return created;
        });

        return {
          refreshedViewerSession,
          comment: {
            id: comment.id,
            trackSpotifyId: comment.trackSpotifyId,
            threadRootId: comment.threadRootId,
            parentCommentId: comment.parentCommentId,
            timestampMs: comment.timestampMs,
            markerBucketSecond: comment.markerBucketSecond,
            body: comment.body,
            createdAt: comment.createdAt.toISOString(),
            updatedAt: comment.updatedAt.toISOString(),
            author: mapAuthor(comment),
            replies: [],
          } satisfies CommentThread,
        };
      }, { refreshViewerSession: true }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.songComment.findFirst({
        where: {
          authorSpotifyUserId: viewerSession.spotifyUserId,
          clientSubmissionId: input.clientSubmissionId,
        },
        select: {
          id: true,
          trackSpotifyId: true,
          threadRootId: true,
          parentCommentId: true,
          timestampMs: true,
          markerBucketSecond: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          authorSpotifyUserId: true,
          authorDisplayNameSnapshot: true,
          authorImageUrlSnapshot: true,
          authorProfileUrlSnapshot: true,
        },
      }).catch(() => null);

      if (existing) {
        return {
          refreshedViewerSession: null,
          comment: {
            id: existing.id,
            trackSpotifyId: existing.trackSpotifyId,
            threadRootId: existing.threadRootId,
            parentCommentId: existing.parentCommentId,
            timestampMs: existing.timestampMs,
            markerBucketSecond: existing.markerBucketSecond,
            body: existing.body,
            createdAt: existing.createdAt.toISOString(),
            updatedAt: existing.updatedAt.toISOString(),
            author: mapAuthor(existing),
            replies: [],
          } satisfies CommentThread,
        };
      }
    }

    throw error;
  }
}

export async function createReplyComment(input: {
  parentCommentId: string;
  body: string;
  clientSubmissionId: string;
}) {
  const viewerSession = await getViewerSession();
  if (!viewerSession?.spotifyUserId) {
    throw new CommentUnauthorizedError("Viewer sign-in is required.");
  }

  const normalizedBody = normalizeBody(input.body);

  try {
    return await ensureCommentTables(async () =>
      withViewerSpotifyAccessToken(async (accessToken, auth, refreshedViewerSession) => {
        const [profile, parent] = await Promise.all([
          getCurrentUser(accessToken).catch(() => null),
          db.songComment.findUnique({
            where: { id: input.parentCommentId },
            select: {
              id: true,
              trackSpotifyId: true,
              threadRootId: true,
              markerBucketSecond: true,
              timestampMs: true,
            },
          }),
        ]);

        if (!parent) {
          throw new CommentValidationError("Parent comment was not found.");
        }

        if (profile) {
          await upsertSpotifyUserProfile(profile);
        }

        const comment = await db.$transaction(async (tx) => {
          const created = await tx.songComment.create({
            data: {
              id: crypto.randomUUID(),
              trackSpotifyId: parent.trackSpotifyId,
              threadRootId: parent.threadRootId,
              parentCommentId: parent.id,
              authorSpotifyUserId: auth.spotifyUserId,
              authorDisplayNameSnapshot: profile?.display_name ?? null,
              authorProfileUrlSnapshot: profile?.external_urls?.spotify ?? null,
              authorImageUrlSnapshot: profile?.images?.[0]?.url ?? null,
              clientSubmissionId: input.clientSubmissionId,
              timestampMs: parent.timestampMs,
              markerBucketSecond: parent.markerBucketSecond,
              body: normalizedBody,
              moderationState: "VISIBLE",
            },
            select: {
              id: true,
              trackSpotifyId: true,
              threadRootId: true,
              parentCommentId: true,
              timestampMs: true,
              markerBucketSecond: true,
              body: true,
              createdAt: true,
              updatedAt: true,
              authorSpotifyUserId: true,
              authorDisplayNameSnapshot: true,
              authorImageUrlSnapshot: true,
              authorProfileUrlSnapshot: true,
            },
          });

          await tx.songComment.update({
            where: { id: parent.threadRootId },
            data: {
              replyCount: {
                increment: 1,
              },
            },
          });

          return created;
        });

        return {
          refreshedViewerSession,
          comment: {
            id: comment.id,
            trackSpotifyId: comment.trackSpotifyId,
            threadRootId: comment.threadRootId,
            parentCommentId: comment.parentCommentId,
            timestampMs: comment.timestampMs,
            markerBucketSecond: comment.markerBucketSecond,
            body: comment.body,
            createdAt: comment.createdAt.toISOString(),
            updatedAt: comment.updatedAt.toISOString(),
            author: mapAuthor(comment),
            replies: [],
          } satisfies CommentThread,
        };
      }, { refreshViewerSession: true }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.songComment.findFirst({
        where: {
          authorSpotifyUserId: viewerSession.spotifyUserId,
          clientSubmissionId: input.clientSubmissionId,
        },
        select: {
          id: true,
          trackSpotifyId: true,
          threadRootId: true,
          parentCommentId: true,
          timestampMs: true,
          markerBucketSecond: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          authorSpotifyUserId: true,
          authorDisplayNameSnapshot: true,
          authorImageUrlSnapshot: true,
          authorProfileUrlSnapshot: true,
        },
      }).catch(() => null);

      if (existing) {
        return {
          refreshedViewerSession: null,
          comment: {
            id: existing.id,
            trackSpotifyId: existing.trackSpotifyId,
            threadRootId: existing.threadRootId,
            parentCommentId: existing.parentCommentId,
            timestampMs: existing.timestampMs,
            markerBucketSecond: existing.markerBucketSecond,
            body: existing.body,
            createdAt: existing.createdAt.toISOString(),
            updatedAt: existing.updatedAt.toISOString(),
            author: mapAuthor(existing),
            replies: [],
          } satisfies CommentThread,
        };
      }
    }

    throw error;
  }
}

export function isRetryableCommentPlaybackError(error: unknown) {
  return error instanceof CommentPlaybackMismatchError;
}

export function isCommentFeatureUnavailable(error: unknown) {
  return isCommentFeatureUnavailableError(error);
}
