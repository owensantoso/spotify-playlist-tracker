import { ActiveSongsSearchController } from "@/components/active-songs-search-controller";
import { SongTable } from "@/components/song-table";
import { SectionCard } from "@/components/section-card";
import { getCommentCountMap } from "@/lib/services/comment-service";
import { getNowPlayingTrack } from "@/lib/services/now-playing-service";
import { getSpotifyUserAvatarMap } from "@/lib/services/spotify-user-service";
import { type ActiveSongsSortBy, type SortDirection, getActiveSongs } from "@/lib/services/stats-service";

type ActiveSongsPageProps = {
  searchParams: Promise<{
    q?: string;
    sort?: ActiveSongsSortBy;
    dir?: SortDirection;
  }>;
};

export default async function ActiveSongsPage({ searchParams }: ActiveSongsPageProps) {
  const { q, sort, dir } = await searchParams;
  const sortBy = sort && ["track", "artist", "addedBy", "addedAt", "age"].includes(sort) ? sort : "age";
  const sortDirection = dir === "asc" ? "asc" : "desc";
  const [rows, nowPlaying] = await Promise.all([
    getActiveSongs({
      sortBy,
      sortDirection,
    }),
    getNowPlayingTrack(),
  ]);
  const [contributorAvatars, commentCounts] = await Promise.all([
    getSpotifyUserAvatarMap(rows.map((row) => row.addedBySpotifyUserId)),
    getCommentCountMap(rows.map((row) => row.trackSpotifyId)),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <SectionCard title="Active songs" eyebrow="Current snapshot">
        <div className="mb-4">
          <input
            id="active-search-input"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Search tracks or artists"
            className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-2.5 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-[--color-accent]"
            aria-label="Search active songs"
          />
        </div>
        <SongTable
          rows={rows.map((row) => ({
            id: row.id,
            spotifyTrackId: row.trackSpotifyId,
            artworkUrl: row.track.artworkUrl,
            title: row.track.name,
            titleRomanized: row.track.nameRomanized,
            artists: row.track.artistNames,
            artistsRomanized: row.track.artistNamesRomanized,
            artistSpotifyUrls: row.track.artistSpotifyUrls,
            contributor: row.addedBy?.displayName ?? row.addedBySpotifyUserId ?? null,
            contributorSpotifyUserId: row.addedBySpotifyUserId,
            contributorProfileUrl: row.addedBy?.profileUrl ?? null,
            contributorImageUrl: row.addedBySpotifyUserId ? contributorAvatars[row.addedBySpotifyUserId] ?? null : null,
            commentCount: commentCounts[row.trackSpotifyId] ?? 0,
            addedAt: row.spotifyAddedAt,
            firstSeenAt: row.firstSeenAt,
            spotifyUrl: row.track.spotifyUrl,
          }))}
          searchQuery={q ?? ""}
          sortBy={sortBy}
          sortDirection={sortDirection}
          nowPlayingTrackId={nowPlaying?.spotifyTrackId}
        />
        <ActiveSongsSearchController />
      </SectionCard>
    </div>
  );
}
