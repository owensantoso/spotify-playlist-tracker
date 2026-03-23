export const dynamic = "force-dynamic";

import { format } from "date-fns";

import { ActiveTrendCard, ContributorShareCard, HeatmapCard, HistogramCard, RankingBarCard } from "@/components/dashboard-charts";
import { SectionCard } from "@/components/section-card";
import { SongRowList } from "@/components/song-row-list";
import { StatCard } from "@/components/stat-card";
import { getContributorLeaderboard, getDashboardCharts, getLengthStats, getLongestLastingSongs, getOverviewStats, getRecentHistory } from "@/lib/services/stats-service";
import { formatLifetimeMs } from "@/lib/utils";

export default async function HomePage() {
  const [overview, history, longestLasting, leaderboard, charts, lengthStats] = await Promise.all([
    getOverviewStats(),
    getRecentHistory(6),
    getLongestLastingSongs(6),
    getContributorLeaderboard(),
    getDashboardCharts(),
    getLengthStats(6),
  ]);

  if (!overview.publicDashboard) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-16">
        <SectionCard title="Dashboard unavailable" eyebrow="Private mode">
          <p className="text-stone-300">The read-only dashboard is disabled in settings.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8">
      <section className="grid items-start gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <SectionCard title="Playlist intelligence" eyebrow="Read-only analytics" className="self-start">
          <div className="space-y-3">
            <p className="max-w-xl text-sm leading-6 text-stone-300">
              A compact read-only overview of how the playlist changes, who is adding songs, how
              the archive grows, and how long tracks tend to survive.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Active songs over time",
                "Contributor share over time",
                "Calendar heatmap of additions",
                "Length stats",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-stone-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 self-start">
          <StatCard label="Active songs" value={overview.activeSongsCount} />
          <StatCard label="Unique songs" value={overview.totalUniqueSongs} />
          <StatCard label="Contributors" value={overview.contributorsCount} />
          <StatCard label="Median life" value={overview.medianLifetimeLabel} />
          <StatCard
            label="Last sync"
            value={overview.latestSync ? format(overview.latestSync.startedAt, "MMM d, HH:mm") : "Never"}
            hint={`Scheduler target: every ${overview.syncIntervalMinutes} minutes`}
          />
        </div>
      </section>

      <SectionCard title="Track length stats" eyebrow="Runtime view">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Average song length" value={lengthStats.averageSongLengthLabel} />
            <StatCard
              label="Current total playlist length"
              value={lengthStats.currentPlaylistLengthLabel}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/10 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-stone-500">
                Shortest active tracks
              </p>
              <div className="mt-4 space-y-3">
                {lengthStats.shortestActiveTracks.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div>
                      {item.titleRomanized ? (
                        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-stone-400">
                          {item.titleRomanized}
                        </p>
                      ) : null}
                      <p className="text-sm font-medium text-stone-100">{index + 1}. {item.title}</p>
                      {item.artistsRomanized.some((artist, artistIndex) => artist && artist !== item.artists[artistIndex]) ? (
                        <p className="font-mono text-[9px] text-stone-400">{item.artistsRomanized.join(", ")}</p>
                      ) : null}
                      <p className="text-xs text-stone-400">{item.artists.join(", ")}</p>
                    </div>
                    <p className="text-sm text-stone-300">{formatLifetimeMs(item.durationMs)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-black/10 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-stone-500">
                Longest active tracks
              </p>
              <div className="mt-4 space-y-3">
                {lengthStats.longestActiveTracks.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div>
                      {item.titleRomanized ? (
                        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-stone-400">
                          {item.titleRomanized}
                        </p>
                      ) : null}
                      <p className="text-sm font-medium text-stone-100">{index + 1}. {item.title}</p>
                      {item.artistsRomanized.some((artist, artistIndex) => artist && artist !== item.artists[artistIndex]) ? (
                        <p className="font-mono text-[9px] text-stone-400">{item.artistsRomanized.join(", ")}</p>
                      ) : null}
                      <p className="text-xs text-stone-400">{item.artists.join(", ")}</p>
                    </div>
                    <p className="text-sm text-stone-300">{formatLifetimeMs(item.durationMs)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActiveTrendCard
          title="Active songs over time"
          eyebrow="Playlist size"
          description="This is the live playlist size at each sync. It answers the question, 'how full is the playlist right now, and how does that change?'"
          points={charts.activeSongsOverTime}
          labels="Current active songs sampled at each sync"
        />
        <ActiveTrendCard
          title="Archive growth"
          eyebrow="Cumulative history"
          description="Every first-seen song gets mirrored into the archive. This line shows the archive expanding as the playlist history gets deeper."
          points={charts.archiveGrowthOverTime}
          accent="rgba(106, 161, 109, 0.95)"
          labels="Unique archived tracks accumulated over time"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ContributorShareCard
          title="Contributor share over time"
          eyebrow="Who is shaping the mix"
          description="Each band is the share of additions in a week. It highlights when a contributor dominated the new additions, and when the playlist opened up."
          buckets={charts.contributorShareOverTime}
        />
        <HeatmapCard
          title="Calendar heatmap of additions"
          eyebrow="Day-level activity"
          description="Every month is laid out like a calendar. Each cell shows the day number and the count of songs added on that date."
          days={charts.additionsHeatmap}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingBarCard
          title="Top contributors"
          eyebrow="Volume leaders"
          description="A bar chart view of who has added the most songs, with active song count and average lifetime as secondary context."
          items={leaderboard.slice(0, 6).map((row) => ({
            label: row.displayName,
            value: row.totalSongs,
            valueLabel: `${row.totalSongs} songs`,
            meta: `Active ${row.activeSongs} • ${row.averageLifetimeLabel}`,
          }))}
        />
        <RankingBarCard
          title="Longest-lasting tracks"
          eyebrow="Retention leaders"
          description="The songs that survived the longest in the active playlist, ranked by lifecycle duration."
          items={longestLasting.slice(0, 6).map(({ lifecycle, lifetimeMs }) => ({
            label: lifecycle.track.name,
            value: lifetimeMs,
            valueLabel: formatLifetimeMs(lifetimeMs),
            meta: lifecycle.track.artistNames.join(", "),
          }))}
        />
      </div>

      <HistogramCard
        title="Song age at removal"
        eyebrow="Retention spread"
        description="A histogram of how long songs stayed in the playlist before they were removed. This is the quickest way to see whether songs churn fast or hang around."
        bins={charts.removalAgeHistogram}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent additions" eyebrow="Fresh arrivals">
          <SongRowList
            items={history.recentAdditions.map((item) => ({
              id: item.id,
              title: item.track.name,
              titleRomanized: item.track.nameRomanized,
              artists: item.track.artistNames,
              artistsRomanized: item.track.artistNamesRomanized,
              artistSpotifyUrls: item.track.artistSpotifyUrls,
              artworkUrl: item.track.artworkUrl,
              spotifyUrl: item.track.spotifyUrl,
              contributor: item.addedBy?.displayName ?? item.addedBySpotifyUserId ?? null,
              contributorSpotifyUserId: item.addedBySpotifyUserId,
              contributorProfileUrl: item.addedBy?.profileUrl ?? null,
              addedAt: item.spotifyAddedAt,
              firstSeenAt: item.firstSeenAt,
            }))}
            emptyLabel="No additions have been tracked yet."
          />
        </SectionCard>

        <SectionCard title="Recent removals" eyebrow="Rotated out">
          <SongRowList
            items={history.recentRemovals.map((item) => ({
              id: item.id,
              title: item.track.name,
              titleRomanized: item.track.nameRomanized,
              artists: item.track.artistNames,
              artistsRomanized: item.track.artistNamesRomanized,
              artistSpotifyUrls: item.track.artistSpotifyUrls,
              artworkUrl: item.track.artworkUrl,
              spotifyUrl: item.track.spotifyUrl,
              contributor: item.addedBy?.displayName ?? item.addedBySpotifyUserId ?? null,
              contributorSpotifyUserId: item.addedBySpotifyUserId,
              contributorProfileUrl: item.addedBy?.profileUrl ?? null,
              addedAt: item.spotifyAddedAt,
              firstSeenAt: item.firstSeenAt,
              removedObservedAt: item.removedObservedAt,
            }))}
            emptyLabel="No removals observed yet."
            showLifetime
          />
        </SectionCard>
      </div>
    </div>
  );
}
