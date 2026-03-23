/* eslint-disable @next/next/no-img-element */

import { format } from "date-fns";
import Link from "next/link";

import type { ActiveSongsSortBy, SortDirection } from "@/lib/services/stats-service";
import { cn, formatRelativeDuration, getPlaylistStartDate, getSpotifyUserUrl } from "@/lib/utils";

type SongTableRow = {
  id: string;
  spotifyTrackId: string;
  artworkUrl: string | null;
  title: string;
  titleRomanized?: string | null;
  artists: string[];
  artistsRomanized?: string[];
  artistSpotifyUrls: string[];
  contributor: string | null;
  contributorSpotifyUserId?: string | null;
  contributorProfileUrl?: string | null;
  addedAt: Date | null;
  firstSeenAt: Date;
  spotifyUrl: string;
};

type SongTableProps = {
  rows: SongTableRow[];
  searchQuery?: string;
  sortBy: ActiveSongsSortBy;
  sortDirection: SortDirection;
  nowPlayingTrackId?: string | null;
};

type SortableHeaderProps = {
  label: string;
  column: ActiveSongsSortBy;
  sortBy: ActiveSongsSortBy;
  sortDirection: SortDirection;
  searchQuery?: string;
};

function getSortHref(
  column: ActiveSongsSortBy,
  sortBy: ActiveSongsSortBy,
  sortDirection: SortDirection,
  searchQuery?: string,
) {
  const params = new URLSearchParams();
  if (searchQuery) {
    params.set("q", searchQuery);
  }

  const nextDirection = sortBy === column && sortDirection === "desc" ? "asc" : "desc";
  params.set("sort", column);
  params.set("dir", nextDirection);

  return `/active?${params.toString()}`;
}

function SortableHeader({ label, column, sortBy, sortDirection, searchQuery }: SortableHeaderProps) {
  const isActive = sortBy === column;
  const arrow = isActive ? (sortDirection === "desc" ? "↓" : "↑") : null;

  return (
    <th className="pb-2.5 pr-4">
      <Link
        href={getSortHref(column, sortBy, sortDirection, searchQuery)}
        prefetch
        className={`inline-flex cursor-pointer items-center gap-1 transition hover:text-stone-200 ${
          isActive ? "font-semibold text-[--color-accent]" : ""
        }`}
      >
        <span>{label}</span>
        {arrow ? <span aria-hidden="true">{arrow}</span> : null}
      </Link>
    </th>
  );
}

export function SongTable({
  rows,
  searchQuery,
  sortBy,
  sortDirection,
  nowPlayingTrackId,
}: SongTableProps) {
  if (!rows.length) {
    return <p className="text-sm text-stone-400">No active songs match this view yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <p id="active-song-empty" className="hidden text-sm text-stone-400">
        No active songs match this view yet.
      </p>
      <table className="min-w-full table-fixed text-left text-[13px]">
        <colgroup>
          <col className="w-[92px]" />
          <col className="w-[34%]" />
          <col className="w-[28%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
          <tr>
            <th className="pb-2.5 pr-4">Artwork</th>
            <SortableHeader
              label="Track"
              column="track"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
            <SortableHeader
              label="Artist"
              column="artist"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
            <SortableHeader
              label="Added by"
              column="addedBy"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
            <SortableHeader
              label="Added at"
              column="addedAt"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
            <SortableHeader
              label="Age"
              column="age"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
          </tr>
        </thead>
        <tbody id="active-song-body" className="divide-y divide-white/6 text-stone-200">
          {rows.map((row) => {
            const contributorUrl = getSpotifyUserUrl(row.contributorSpotifyUserId, row.contributorProfileUrl);
            const searchValue = `${row.title} ${row.titleRomanized ?? ""} ${row.artists.join(" ")} ${(row.artistsRomanized ?? []).join(" ")}`.toLocaleLowerCase();
            const isNowPlaying = nowPlayingTrackId === row.spotifyTrackId;

            return (
              <tr
                key={row.id}
                data-song-row="true"
                data-search={searchValue}
                className={cn(
                  "transition",
                  isNowPlaying && "bg-[rgba(243,167,92,0.12)] shadow-[inset_0_0_0_1px_rgba(243,167,92,0.22)]",
                )}
              >
                <td className={cn("py-3 pr-4", isNowPlaying && "border-y border-l border-[--color-accent]/35 bg-[rgba(243,167,92,0.08)]")}>
                  <a href={row.spotifyUrl} target="_blank" rel="noreferrer" className="block w-fit">
                    {row.artworkUrl ? (
                      <img
                        src={row.artworkUrl}
                        alt=""
                        className={cn(
                          "h-10 w-10 rounded-xl object-cover",
                          isNowPlaying && "ring-2 ring-[--color-accent] ring-offset-2 ring-offset-[--color-ink] shadow-[0_0_26px_rgba(243,167,92,0.22)]",
                        )}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/6 text-[10px] text-stone-500">
                        n/a
                      </div>
                    )}
                  </a>
                </td>
                <td className={cn("py-3 pr-4 font-medium text-stone-100", isNowPlaying && "border-y border-[--color-accent]/35 bg-[rgba(243,167,92,0.08)]")}>
                  {isNowPlaying ? (
                    <p className="mb-1 inline-flex rounded-full border border-[--color-accent]/45 bg-[--color-accent]/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[--color-accent]">
                      Now playing
                    </p>
                  ) : null}
                  {row.titleRomanized ? (
                    <p className="mb-0.5 truncate font-mono text-[8px] font-normal uppercase leading-[1.15] tracking-[0.04em] text-stone-300">
                      {row.titleRomanized}
                    </p>
                  ) : null}
                  <a
                    href={row.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-[--color-accent]"
                  >
                    {row.title}
                  </a>
                </td>
                <td className={cn("py-3 pr-4", isNowPlaying && "border-y border-[--color-accent]/35 bg-[rgba(243,167,92,0.08)]")}>
                  {row.artistsRomanized?.some((artist, index) => artist && artist !== row.artists[index]) ? (
                    <p className="mb-0.5 truncate font-mono text-[8px] uppercase leading-[1.15] tracking-[0.04em] text-stone-300">
                      {row.artistsRomanized.join(", ")}
                    </p>
                  ) : null}
                  <div className="truncate">
                    {row.artists.map((artist, index) => (
                      <span key={`${row.id}-${artist}-${index}`}>
                        <a
                          href={row.artistSpotifyUrls[index] || `https://open.spotify.com/search/${encodeURIComponent(artist)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="transition hover:text-[--color-accent]"
                        >
                          {artist}
                        </a>
                        {index < row.artists.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={cn("py-3 pr-4", isNowPlaying && "border-y border-[--color-accent]/35 bg-[rgba(243,167,92,0.08)]")}>
                  {row.contributor ? (
                    contributorUrl ? (
                      <a
                        href={contributorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="transition hover:text-[--color-accent]"
                      >
                        {row.contributor}
                      </a>
                    ) : (
                      row.contributor
                    )
                  ) : (
                    "Unknown"
                  )}
                </td>
                <td className={cn("py-3 pr-4", isNowPlaying && "border-y border-[--color-accent]/35 bg-[rgba(243,167,92,0.08)]")}>
                  {row.addedAt ? format(row.addedAt, "MMM d, yyyy") : "Unknown"}
                </td>
                <td className={cn("py-3 pr-4", isNowPlaying && "border-y border-r border-[--color-accent]/35 bg-[rgba(243,167,92,0.08)]")}>
                  {formatRelativeDuration(getPlaylistStartDate(row.addedAt, row.firstSeenAt))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
