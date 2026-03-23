import "server-only";

import { LifecycleStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getCommentCountMap, getCommentTrackPayload } from "@/lib/services/comment-service";
import { getTrackReactionSnapshot } from "@/lib/services/reaction-service";
import type { NowPlayingTrack } from "@/lib/services/now-playing-service";
import { formatLifetimeMs, getPlaylistStartDate } from "@/lib/utils";

function getTrackLifetimeMs(startAt: Date, endAt: Date) {
  return Math.max(0, endAt.getTime() - startAt.getTime());
}

export type SongPageData = {
  track: NowPlayingTrack;
  stats: {
    isActive: boolean;
    appearances: number;
    contributors: number;
    firstSeenAt: Date | null;
    latestAddedAt: Date | null;
    latestRemovedAt: Date | null;
    totalLifetimeLabel: string;
    commentCount: number;
    likeScore: number;
  };
  lifecycles: Array<{
    id: string;
    status: LifecycleStatus;
    addedAt: Date | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
    removedObservedAt: Date | null;
    contributor: string | null;
    contributorImageUrl: string | null;
    contributorProfileUrl: string | null;
    lifetimeLabel: string;
  }>;
  comments: Awaited<ReturnType<typeof getCommentTrackPayload>>;
};

export async function getSongPageData(trackSpotifyId: string): Promise<SongPageData | null> {
  const track = await db.track.findUnique({
    where: {
      spotifyTrackId: trackSpotifyId,
    },
    include: {
      lifecycles: {
        include: {
          addedBy: true,
        },
        orderBy: [
          { firstSeenAt: "desc" },
          { createdAt: "desc" },
        ],
      },
    },
  });

  if (!track) {
    return null;
  }

  const [commentCounts, reactionSnapshot, comments] = await Promise.all([
    getCommentCountMap([trackSpotifyId]),
    getTrackReactionSnapshot([trackSpotifyId]),
    getCommentTrackPayload(trackSpotifyId),
  ]);

  const firstSeenAt = track.lifecycles.reduce<Date | null>((earliest, lifecycle) => {
    if (!earliest || lifecycle.firstSeenAt < earliest) {
      return lifecycle.firstSeenAt;
    }
    return earliest;
  }, null);

  const latestAddedAt = track.lifecycles.reduce<Date | null>((latest, lifecycle) => {
    const startAt = getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt);
    if (!latest || startAt > latest) {
      return startAt;
    }
    return latest;
  }, null);

  const latestRemovedAt = track.lifecycles.reduce<Date | null>((latest, lifecycle) => {
    if (!lifecycle.removedObservedAt) {
      return latest;
    }

    if (!latest || lifecycle.removedObservedAt > latest) {
      return lifecycle.removedObservedAt;
    }

    return latest;
  }, null);

  const totalLifetimeMs = track.lifecycles.reduce((total, lifecycle) => {
    const startAt = getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt);
    const endAt =
      lifecycle.removedObservedAt ??
      (lifecycle.status === LifecycleStatus.ACTIVE ? new Date() : lifecycle.lastSeenAt);

    return total + getTrackLifetimeMs(startAt, endAt);
  }, 0);

  const contributors = new Set(
    track.lifecycles
      .map((lifecycle) => lifecycle.addedBySpotifyUserId)
      .filter((value): value is string => Boolean(value)),
  ).size;

  return {
    track: {
      spotifyTrackId: track.spotifyTrackId,
      title: track.name,
      titleRomanized: track.nameRomanized,
      artists: track.artistNames,
      artistsRomanized: track.artistNamesRomanized,
      albumName: track.albumName,
      artworkUrl: track.artworkUrl,
      spotifyUrl: track.spotifyUrl,
      durationMs: track.durationMs,
      progressMs: 0,
      deviceName: null,
      isPlaying: false,
    },
    stats: {
      isActive: track.lifecycles.some((lifecycle) => lifecycle.status === LifecycleStatus.ACTIVE),
      appearances: track.lifecycles.length,
      contributors,
      firstSeenAt,
      latestAddedAt,
      latestRemovedAt,
      totalLifetimeLabel: totalLifetimeMs ? formatLifetimeMs(totalLifetimeMs) : "n/a",
      commentCount: commentCounts[trackSpotifyId] ?? 0,
      likeScore: reactionSnapshot.scoreByTrackId[trackSpotifyId] ?? 0,
    },
    lifecycles: track.lifecycles.map((lifecycle) => {
      const startAt = getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt);
      const endAt =
        lifecycle.removedObservedAt ??
        (lifecycle.status === LifecycleStatus.ACTIVE ? new Date() : lifecycle.lastSeenAt);

      return {
        id: lifecycle.id,
        status: lifecycle.status,
        addedAt: lifecycle.spotifyAddedAt,
        firstSeenAt: lifecycle.firstSeenAt,
        lastSeenAt: lifecycle.lastSeenAt,
        removedObservedAt: lifecycle.removedObservedAt,
        contributor: lifecycle.addedBy?.displayName ?? lifecycle.addedBySpotifyUserId ?? null,
        contributorImageUrl: lifecycle.addedBy?.imageUrl ?? null,
        contributorProfileUrl: lifecycle.addedBy?.profileUrl ?? null,
        lifetimeLabel: formatLifetimeMs(getTrackLifetimeMs(startAt, endAt)),
      };
    }),
    comments,
  };
}
