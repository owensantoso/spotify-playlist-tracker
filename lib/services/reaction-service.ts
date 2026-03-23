import "server-only";

import { Prisma, SongReactionKind } from "@prisma/client";

import { db } from "@/lib/db";
import { getViewerSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/spotify/client";
import { withViewerSpotifyAccessToken } from "@/lib/services/now-playing-service";
import { upsertSpotifyUserProfile } from "@/lib/services/user-account-service";

const reactionWeights: Record<SongReactionKind, number> = {
  LIKE: 1,
  SUPERLIKE: 2,
};

export class ReactionFeatureUnavailableError extends Error {}
export class ReactionUnauthorizedError extends Error {}

function isReactionFeatureUnavailableError(error: unknown) {
  return (
    error instanceof ReactionFeatureUnavailableError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022"))
  );
}

async function ensureReactionTables<T>(callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    if (isReactionFeatureUnavailableError(error)) {
      throw new ReactionFeatureUnavailableError("Song reactions are unavailable.");
    }

    throw error;
  }
}

export type TrackReactionSnapshot = {
  featureAvailable: boolean;
  scoreByTrackId: Record<string, number>;
  viewerReactionByTrackId: Record<string, SongReactionKind | null>;
};

export async function getTrackReactionSnapshot(
  trackSpotifyIds: string[],
): Promise<TrackReactionSnapshot> {
  const uniqueTrackIds = [...new Set(trackSpotifyIds.filter(Boolean))];
  if (!uniqueTrackIds.length) {
    return {
      featureAvailable: true,
      scoreByTrackId: {},
      viewerReactionByTrackId: {},
    };
  }

  const viewerSession = await getViewerSession();

  try {
    return await ensureReactionTables(async () => {
      const reactions = await db.songReaction.findMany({
        where: {
          trackSpotifyId: {
            in: uniqueTrackIds,
          },
        },
        select: {
          trackSpotifyId: true,
          spotifyUserId: true,
          kind: true,
        },
      });

      const scoreByTrackId = uniqueTrackIds.reduce<Record<string, number>>((acc, trackSpotifyId) => {
        acc[trackSpotifyId] = 0;
        return acc;
      }, {});
      const viewerReactionByTrackId = uniqueTrackIds.reduce<Record<string, SongReactionKind | null>>(
        (acc, trackSpotifyId) => {
          acc[trackSpotifyId] = null;
          return acc;
        },
        {},
      );

      for (const reaction of reactions) {
        scoreByTrackId[reaction.trackSpotifyId] =
          (scoreByTrackId[reaction.trackSpotifyId] ?? 0) + reactionWeights[reaction.kind];

        if (viewerSession?.spotifyUserId === reaction.spotifyUserId) {
          viewerReactionByTrackId[reaction.trackSpotifyId] = reaction.kind;
        }
      }

      return {
        featureAvailable: true,
        scoreByTrackId,
        viewerReactionByTrackId,
      };
    });
  } catch (error) {
    if (isReactionFeatureUnavailableError(error)) {
      return {
        featureAvailable: false,
        scoreByTrackId: {},
        viewerReactionByTrackId: {},
      };
    }

    throw error;
  }
}

export async function setTrackReaction(input: {
  trackSpotifyId: string;
  kind: SongReactionKind;
}) {
  const viewerSession = await getViewerSession();
  if (!viewerSession?.spotifyUserId) {
    throw new ReactionUnauthorizedError("Sign in with Spotify to react.");
  }

  try {
    return await ensureReactionTables(async () => {
      const result = await withViewerSpotifyAccessToken(async (accessToken, auth) => {
        const profile = await getCurrentUser(accessToken);
        await upsertSpotifyUserProfile(profile);

        await db.$transaction(async (tx) => {
          const existing = await tx.songReaction.findUnique({
            where: {
              trackSpotifyId_spotifyUserId: {
                trackSpotifyId: input.trackSpotifyId,
                spotifyUserId: auth.spotifyUserId,
              },
            },
          });

          if (existing?.kind === input.kind) {
            await tx.songReaction.delete({
              where: {
                trackSpotifyId_spotifyUserId: {
                  trackSpotifyId: input.trackSpotifyId,
                  spotifyUserId: auth.spotifyUserId,
                },
              },
            });
            return;
          }

          await tx.songReaction.upsert({
            where: {
              trackSpotifyId_spotifyUserId: {
                trackSpotifyId: input.trackSpotifyId,
                spotifyUserId: auth.spotifyUserId,
              },
            },
            update: {
              kind: input.kind,
            },
            create: {
              trackSpotifyId: input.trackSpotifyId,
              spotifyUserId: auth.spotifyUserId,
              kind: input.kind,
            },
          });
        });

        const reactions = await db.songReaction.findMany({
          where: {
            trackSpotifyId: input.trackSpotifyId,
          },
          select: {
            spotifyUserId: true,
            kind: true,
          },
        });

        const score = reactions.reduce((total, reaction) => total + reactionWeights[reaction.kind], 0);
        const viewerReaction =
          reactions.find((reaction) => reaction.spotifyUserId === auth.spotifyUserId)?.kind ?? null;

        return {
          ok: true,
          score,
          viewerReaction,
        };
      }, { refreshViewerSession: true });

      return result;
    });
  } catch (error) {
    if (isReactionFeatureUnavailableError(error)) {
      throw new ReactionFeatureUnavailableError("Song reactions are unavailable.");
    }

    throw error;
  }
}
