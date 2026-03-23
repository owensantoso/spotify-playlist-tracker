import "server-only";

import { LifecycleStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  eachDayOfInterval,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns";

import { cacheTags } from "@/lib/cache-tags";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { db } from "@/lib/db";
import { getCachedSettings } from "@/lib/services/settings-service";
import { formatLifetimeMs, getPlaylistStartDate } from "@/lib/utils";

export type ActiveSongsSortBy = "track" | "artist" | "addedBy" | "addedAt" | "age";
export type SortDirection = "asc" | "desc";

export type TimeSeriesPoint = {
  label: string;
  value: number;
};

export type ContributorShareBucket = {
  label: string;
  periodStart: Date;
  total: number;
  series: Array<{
    label: string;
    value: number;
  }>;
};

export type HeatmapDay = {
  date: Date;
  label: string;
  value: number;
};

export type HistogramBucket = {
  label: string;
  value: number;
};

export type ActiveTrackLengthItem = {
  id: string;
  title: string;
  titleRomanized: string | null;
  artists: string[];
  artistsRomanized: string[];
  durationMs: number;
  spotifyUrl: string;
  contributorLabel: string;
};

export type LengthStats = {
  averageSongLengthLabel: string;
  currentPlaylistLengthLabel: string;
  shortestActiveTracks: ActiveTrackLengthItem[];
  longestActiveTracks: ActiveTrackLengthItem[];
};

export type DashboardCharts = {
  activeSongsOverTime: TimeSeriesPoint[];
  archiveGrowthOverTime: TimeSeriesPoint[];
  contributorShareOverTime: ContributorShareBucket[];
  additionsHeatmap: HeatmapDay[];
  removalAgeHistogram: HistogramBucket[];
};

function computeLifetimeMs(startAt: Date, endAt: Date) {
  return endAt.getTime() - startAt.getTime();
}

function formatTrackLength(durationMs: number) {
  return formatLifetimeMs(durationMs);
}

function getDayKey(date: Date) {
  return format(startOfDay(date), "yyyy-MM-dd");
}

function getWeekKey(date: Date) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function buildContinuousDaySeries(
  countsByDay: Map<string, number>,
  startDate: Date,
  endDate: Date,
) {
  return eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) }).map((date) => {
    const key = getDayKey(date);
    return {
      date,
      label: format(date, "MMM d"),
      value: countsByDay.get(key) ?? 0,
    };
  });
}

async function readOverviewStats() {
  const settings = await getCachedSettings();
  const mainPlaylistId = settings?.mainPlaylistId;
  const [activeSongsCount, totalUniqueSongs, contributorRows, latestSync, removedLifecycles] =
    await Promise.all([
      db.trackLifecycle.count({
        where: {
          status: LifecycleStatus.ACTIVE,
          playlistSpotifyId: mainPlaylistId,
        },
      }),
      db.trackLifecycle.findMany({
        where: {
          playlistSpotifyId: mainPlaylistId,
        },
        distinct: ["trackSpotifyId"],
        select: { trackSpotifyId: true },
      }),
      db.trackLifecycle.findMany({
        where: {
          playlistSpotifyId: mainPlaylistId,
          addedBySpotifyUserId: { not: null },
        },
        distinct: ["addedBySpotifyUserId"],
        select: { addedBySpotifyUserId: true },
      }),
      db.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      db.trackLifecycle.findMany({
        where: {
          status: LifecycleStatus.REMOVED,
          playlistSpotifyId: mainPlaylistId,
        },
        select: { firstSeenAt: true, spotifyAddedAt: true, removedObservedAt: true },
      }),
    ]);

  const durations = removedLifecycles
    .filter((item) => item.removedObservedAt)
    .map((item) =>
      computeLifetimeMs(
        getPlaylistStartDate(item.spotifyAddedAt, item.firstSeenAt),
        item.removedObservedAt!,
      ),
    )
    .sort((left, right) => left - right);

  const medianLifetimeMs =
    durations.length === 0
      ? null
      : durations[Math.floor(durations.length / 2)];

  return {
    publicDashboard: settings?.publicDashboard ?? true,
    syncIntervalMinutes: settings?.syncIntervalMinutes ?? 60,
    activeSongsCount,
    totalUniqueSongs: totalUniqueSongs.length,
    contributorsCount: contributorRows.length,
    latestSync,
    medianLifetimeLabel: formatLifetimeMs(medianLifetimeMs),
  };
}

const getOverviewStatsCached = unstable_cache(readOverviewStats, ["overview-stats"], {
  tags: [cacheTags.overviewStats],
  revalidate: 60,
});

export async function getOverviewStats() {
  try {
    return await getOverviewStatsCached();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        publicDashboard: true,
        syncIntervalMinutes: 60,
        activeSongsCount: 0,
        totalUniqueSongs: 0,
        contributorsCount: 0,
        latestSync: null,
        medianLifetimeLabel: "n/a",
      };
    }

    throw error;
  }
}

async function readLengthStats(limit = 6): Promise<LengthStats> {
  const settings = await getCachedSettings();
  const activeLifecycles = await db.trackLifecycle.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      playlistSpotifyId: settings?.mainPlaylistId,
    },
    include: {
      track: true,
      addedBy: true,
    },
  });

  const durations = activeLifecycles
    .map((lifecycle) => lifecycle.track.durationMs ?? 0)
    .filter((duration) => duration > 0);

  const sortedDurations = [...durations].sort((left, right) => left - right);
  const averageDurationMs =
    sortedDurations.length > 0
      ? Math.round(sortedDurations.reduce((sum, value) => sum + value, 0) / sortedDurations.length)
      : null;

  const items = activeLifecycles
    .filter((lifecycle) => lifecycle.track.durationMs != null)
    .map((lifecycle) => ({
      id: lifecycle.id,
      title: lifecycle.track.name,
      titleRomanized: lifecycle.track.nameRomanized,
      artists: lifecycle.track.artistNames,
      artistsRomanized: lifecycle.track.artistNamesRomanized,
      durationMs: lifecycle.track.durationMs ?? 0,
      spotifyUrl: lifecycle.track.spotifyUrl,
      contributorLabel: lifecycle.addedBy?.displayName ?? lifecycle.addedBySpotifyUserId ?? "Unknown",
    }))
    .sort((left, right) => left.durationMs - right.durationMs);

  const currentPlaylistLengthMs = items.reduce((sum, item) => sum + item.durationMs, 0);

  return {
    averageSongLengthLabel: averageDurationMs ? formatTrackLength(averageDurationMs) : "n/a",
    currentPlaylistLengthLabel: currentPlaylistLengthMs
      ? formatTrackLength(currentPlaylistLengthMs)
      : "n/a",
    shortestActiveTracks: items.slice(0, limit),
    longestActiveTracks: [...items].slice(-limit).reverse(),
  };
}

const getLengthStatsCached = unstable_cache(readLengthStats, ["length-stats"], {
  tags: [cacheTags.lengthStats],
  revalidate: 60,
});

export async function getLengthStats(limit = 6): Promise<LengthStats> {
  try {
    return await getLengthStatsCached(limit);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        averageSongLengthLabel: "n/a",
        currentPlaylistLengthLabel: "n/a",
        shortestActiveTracks: [],
        longestActiveTracks: [],
      };
    }

    throw error;
  }
}

async function readMainPlaylistHeader() {
  const settings = await getCachedSettings();
  const playlist = settings?.mainPlaylistId
    ? await db.playlist.findUnique({
        where: { spotifyPlaylistId: settings.mainPlaylistId },
        select: { name: true, spotifyPlaylistId: true },
      })
    : null;

  const spotifyPlaylistId = playlist?.spotifyPlaylistId ?? settings?.mainPlaylistId ?? null;

  return {
    name: playlist?.name ?? "Flavor of the Moment",
    spotifyUrl: spotifyPlaylistId
      ? `https://open.spotify.com/playlist/${spotifyPlaylistId}`
      : null,
  };
}

const getMainPlaylistHeaderCached = unstable_cache(readMainPlaylistHeader, ["app-shell"], {
  tags: [cacheTags.appShell],
  revalidate: 60 * 5,
});

export async function getMainPlaylistHeader() {
  try {
    return await getMainPlaylistHeaderCached();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        name: "Flavor of the Moment",
        spotifyUrl: null,
      };
    }

    throw error;
  }
}

function compareText(left: string, right: string, direction: SortDirection) {
  return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
}

function compareNumber(left: number, right: number, direction: SortDirection) {
  return direction === "asc" ? left - right : right - left;
}

async function readActiveSongs({
  query,
  sortBy = "age",
  sortDirection = "desc",
}: {
  query?: string;
  sortBy?: ActiveSongsSortBy;
  sortDirection?: SortDirection;
} = {}) {
  const settings = await getCachedSettings();
  const lifecycles = await db.trackLifecycle.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      playlistSpotifyId: settings?.mainPlaylistId,
    },
    include: {
      track: true,
      addedBy: true,
    },
  });

  const normalizedQuery = query?.trim().toLocaleLowerCase() ?? "";

  const filtered = normalizedQuery
    ? lifecycles.filter((lifecycle) => {
        const haystack = [
          lifecycle.track.name,
          lifecycle.track.artistNames.join(" "),
        ]
          .join(" ")
          .toLocaleLowerCase();

        return haystack.includes(normalizedQuery);
      })
    : lifecycles;

  return filtered.sort((left, right) => {
    if (sortBy === "track") {
      return compareText(left.track.name, right.track.name, sortDirection);
    }

    if (sortBy === "artist") {
      return compareText(
        left.track.artistNames.join(", "),
        right.track.artistNames.join(", "),
        sortDirection,
      );
    }

    if (sortBy === "addedBy") {
      return compareText(
        left.addedBy?.displayName ?? left.addedBySpotifyUserId ?? "",
        right.addedBy?.displayName ?? right.addedBySpotifyUserId ?? "",
        sortDirection,
      );
    }

    if (sortBy === "addedAt") {
      return compareNumber(
        getPlaylistStartDate(left.spotifyAddedAt, left.firstSeenAt).getTime(),
        getPlaylistStartDate(right.spotifyAddedAt, right.firstSeenAt).getTime(),
        sortDirection,
      );
    }

    return compareNumber(
      getPlaylistStartDate(left.spotifyAddedAt, left.firstSeenAt).getTime(),
      getPlaylistStartDate(right.spotifyAddedAt, right.firstSeenAt).getTime(),
      sortDirection === "asc" ? "desc" : "asc",
    );
  });
}

const getActiveSongsCached = unstable_cache(readActiveSongs, ["active-songs"], {
  tags: [cacheTags.activeSongs],
  revalidate: 60,
});

export async function getActiveSongs(options: {
  query?: string;
  sortBy?: ActiveSongsSortBy;
  sortDirection?: SortDirection;
} = {}) {
  try {
    return await getActiveSongsCached(options);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return [];
    }

    throw error;
  }
}

async function readRecentHistory(limit = 12) {
  const settings = await getCachedSettings();
  const [additionCandidates, recentRemovals] = await Promise.all([
    db.trackLifecycle.findMany({
      where: {
        status: LifecycleStatus.ACTIVE,
        playlistSpotifyId: settings?.mainPlaylistId,
      },
      include: { track: true, addedBy: true },
    }),
    db.trackLifecycle.findMany({
      where: {
        status: LifecycleStatus.REMOVED,
        playlistSpotifyId: settings?.mainPlaylistId,
      },
      include: { track: true, addedBy: true },
      orderBy: { removedObservedAt: "desc" },
      take: limit,
    }),
  ]);

  const recentAdditions = additionCandidates
    .sort((left, right) => {
      const leftStart = getPlaylistStartDate(left.spotifyAddedAt, left.firstSeenAt).getTime();
      const rightStart = getPlaylistStartDate(right.spotifyAddedAt, right.firstSeenAt).getTime();
      return rightStart - leftStart;
    })
    .slice(0, limit);

  return { recentAdditions, recentRemovals };
}

const getRecentHistoryCached = unstable_cache(readRecentHistory, ["recent-history"], {
  tags: [cacheTags.recentHistory],
  revalidate: 60,
});

export async function getRecentHistory(limit = 12) {
  try {
    return await getRecentHistoryCached(limit);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        recentAdditions: [],
        recentRemovals: [],
      };
    }

    throw error;
  }
}

async function readContributorLeaderboard() {
  const settings = await getCachedSettings();
  const lifecycles = await db.trackLifecycle.findMany({
    where: {
      addedBySpotifyUserId: { not: null },
      playlistSpotifyId: settings?.mainPlaylistId,
    },
    include: {
      addedBy: true,
    },
  });

  const contributors = new Map<
    string,
    {
      spotifyUserId: string;
      displayName: string;
      profileUrl: string | null;
      totalSongs: number;
      activeSongs: number;
      totalLifetimeMs: number;
      completedSongs: number;
    }
  >();

  for (const lifecycle of lifecycles) {
    if (!lifecycle.addedBySpotifyUserId) {
      continue;
    }

    const entry =
      contributors.get(lifecycle.addedBySpotifyUserId) ??
      {
        spotifyUserId: lifecycle.addedBySpotifyUserId,
        displayName: lifecycle.addedBy?.displayName ?? lifecycle.addedBySpotifyUserId,
        profileUrl: lifecycle.addedBy?.profileUrl ?? null,
        totalSongs: 0,
        activeSongs: 0,
        totalLifetimeMs: 0,
        completedSongs: 0,
      };

    entry.totalSongs += 1;
    if (lifecycle.status === LifecycleStatus.ACTIVE) {
      entry.activeSongs += 1;
    }
    if (lifecycle.removedObservedAt) {
      entry.totalLifetimeMs += computeLifetimeMs(
        getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt),
        lifecycle.removedObservedAt,
      );
      entry.completedSongs += 1;
    }

    contributors.set(lifecycle.addedBySpotifyUserId, entry);
  }

  return [...contributors.values()]
    .map((entry) => ({
      ...entry,
      averageLifetimeLabel:
        entry.completedSongs > 0
          ? formatLifetimeMs(Math.round(entry.totalLifetimeMs / entry.completedSongs))
          : "n/a",
    }))
    .sort((left, right) => right.totalSongs - left.totalSongs);
}

const getContributorLeaderboardCached = unstable_cache(
  readContributorLeaderboard,
  ["contributor-leaderboard"],
  {
    tags: [cacheTags.contributorLeaderboard],
    revalidate: 60,
  },
);

export async function getContributorLeaderboard() {
  try {
    return await getContributorLeaderboardCached();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return [];
    }

    throw error;
  }
}

async function readLongestLastingSongs(limit = 10) {
  const settings = await getCachedSettings();
  const lifecycles = await db.trackLifecycle.findMany({
    where: {
      playlistSpotifyId: settings?.mainPlaylistId,
    },
    include: { track: true, addedBy: true },
  });

  return lifecycles
    .map((lifecycle) => ({
      lifecycle,
      lifetimeMs: computeLifetimeMs(
        getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt),
        lifecycle.removedObservedAt ?? new Date(),
      ),
    }))
    .sort((left, right) => right.lifetimeMs - left.lifetimeMs)
    .slice(0, limit);
}

const getLongestLastingSongsCached = unstable_cache(
  readLongestLastingSongs,
  ["longest-lasting-songs"],
  {
    tags: [cacheTags.longestLastingSongs],
    revalidate: 60,
  },
);

export async function getLongestLastingSongs(limit = 10) {
  try {
    return await getLongestLastingSongsCached(limit);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return [];
    }

    throw error;
  }
}

async function readSyncRuns(limit = 25) {
  return db.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

const getSyncRunsCached = unstable_cache(readSyncRuns, ["sync-runs"], {
  tags: [cacheTags.syncRuns],
  revalidate: 30,
});

export async function getSyncRuns(limit = 25) {
  try {
    return await getSyncRunsCached(limit);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return [];
    }

    throw error;
  }
}

async function readDashboardCharts(): Promise<DashboardCharts> {
  const settings = await getCachedSettings();
  const mainPlaylistId = settings?.mainPlaylistId;

  if (!mainPlaylistId) {
    return {
      activeSongsOverTime: [],
      archiveGrowthOverTime: [],
      contributorShareOverTime: [],
      additionsHeatmap: [],
      removalAgeHistogram: [],
    };
  }

  const [syncRuns, archiveEntries, lifecycles, removedLifecycles] = await Promise.all([
    db.syncRun.findMany({
      where: { playlistSpotifyId: mainPlaylistId },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true, activeItemsCount: true },
    }),
    db.archiveEntry.findMany({
      where: { playlistSpotifyId: settings.archivePlaylistId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.trackLifecycle.findMany({
      where: {
        playlistSpotifyId: mainPlaylistId,
      },
      include: {
        addedBy: true,
      },
    }),
    db.trackLifecycle.findMany({
      where: {
        playlistSpotifyId: mainPlaylistId,
        status: LifecycleStatus.REMOVED,
        removedObservedAt: { not: null },
      },
      select: {
        firstSeenAt: true,
        spotifyAddedAt: true,
        removedObservedAt: true,
      },
    }),
  ]);

  const activeSongsOverTime = syncRuns.map((run) => ({
    label: format(run.startedAt, "MMM d"),
    value: run.activeItemsCount,
  }));

  const archiveCountsByDay = new Map<string, number>();
  for (const entry of archiveEntries) {
    const key = getDayKey(entry.createdAt);
    archiveCountsByDay.set(key, (archiveCountsByDay.get(key) ?? 0) + 1);
  }

  const archiveGrowthOverTime = archiveEntries.length
    ? (() => {
        const startDate = archiveEntries[0].createdAt;
        const endDate = archiveEntries[archiveEntries.length - 1].createdAt;
        let cumulative = 0;

        return buildContinuousDaySeries(archiveCountsByDay, startDate, endDate).map((point) => {
          cumulative += point.value;
          return {
            label: point.label,
            value: cumulative,
          };
        });
      })()
    : [];

  const contributorTotals = new Map<string, number>();
  const contributorLabels = new Map<string, string>();
  const timelineCounts = new Map<string, Map<string, number>>();

  for (const lifecycle of lifecycles) {
    const contributorKey = lifecycle.addedBySpotifyUserId ?? "unknown";
    const contributorLabel =
      lifecycle.addedBy?.displayName ?? lifecycle.addedBySpotifyUserId ?? "Unknown";
    const startedAt = getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt);
    const weekKey = getWeekKey(startedAt);

    contributorLabels.set(contributorKey, contributorLabel);
    contributorTotals.set(contributorKey, (contributorTotals.get(contributorKey) ?? 0) + 1);

    if (!timelineCounts.has(weekKey)) {
      timelineCounts.set(weekKey, new Map<string, number>());
    }

    const bucket = timelineCounts.get(weekKey)!;
    bucket.set(contributorKey, (bucket.get(contributorKey) ?? 0) + 1);
  }

  const topContributorKeys = [...contributorTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([key]) => key);

  const orderedWeeks = [...timelineCounts.keys()].sort().slice(-16);
  const contributorShareOverTime = orderedWeeks.map((weekKey) => {
    const bucket = timelineCounts.get(weekKey) ?? new Map<string, number>();
    const series = topContributorKeys.map((key) => ({
      label: contributorLabels.get(key) ?? key,
      value: bucket.get(key) ?? 0,
    }));
    const trackedTotal = series.reduce((sum, item) => sum + item.value, 0);
    const total = [...bucket.values()].reduce((sum, value) => sum + value, 0);

    series.push({
      label: "Other",
      value: Math.max(0, total - trackedTotal),
    });

    return {
      label: format(new Date(`${weekKey}T12:00:00`), "MMM d"),
      periodStart: new Date(`${weekKey}T12:00:00`),
      total,
      series,
    };
  });

  const additionsByDay = new Map<string, number>();
  for (const lifecycle of lifecycles) {
    const addedAt = getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt);
    const key = getDayKey(addedAt);
    additionsByDay.set(key, (additionsByDay.get(key) ?? 0) + 1);
  }

  const firstLifecycleDate = lifecycles.reduce<Date | null>((earliest, lifecycle) => {
    const candidate = getPlaylistStartDate(lifecycle.spotifyAddedAt, lifecycle.firstSeenAt);
    return !earliest || candidate < earliest ? candidate : earliest;
  }, null);

  const additionsHeatmap = firstLifecycleDate
    ? buildContinuousDaySeries(
        additionsByDay,
        startOfWeek(firstLifecycleDate, { weekStartsOn: 1 }),
        new Date(),
      ).slice(-84)
    : [];

  const removalAgeHistogramBuckets = [
    { label: "0-7d", min: 0, max: 7 },
    { label: "8-14d", min: 8, max: 14 },
    { label: "15-30d", min: 15, max: 30 },
    { label: "31-60d", min: 31, max: 60 },
    { label: "61-90d", min: 61, max: 90 },
    { label: "90+d", min: 91, max: Number.POSITIVE_INFINITY },
  ];

  const removalAgeHistogram = removalAgeHistogramBuckets.map((bucket) => ({
    label: bucket.label,
    value: removedLifecycles.filter((item) => {
      const removedAt = item.removedObservedAt!;
      const startAt = getPlaylistStartDate(item.spotifyAddedAt, item.firstSeenAt);
      const ageDays = Math.max(0, differenceInCalendarDays(removedAt, startAt));
      return ageDays >= bucket.min && ageDays <= bucket.max;
    }).length,
  }));

  return {
    activeSongsOverTime,
    archiveGrowthOverTime,
    contributorShareOverTime,
    additionsHeatmap,
    removalAgeHistogram,
  };
}

const getDashboardChartsCached = unstable_cache(readDashboardCharts, ["dashboard-charts"], {
  tags: [cacheTags.dashboardCharts],
  revalidate: 60,
});

export async function getDashboardCharts(): Promise<DashboardCharts> {
  try {
    return await getDashboardChartsCached();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        activeSongsOverTime: [],
        archiveGrowthOverTime: [],
        contributorShareOverTime: [],
        additionsHeatmap: [],
        removalAgeHistogram: [],
      };
    }

    throw error;
  }
}
