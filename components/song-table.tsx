/* eslint-disable @next/next/no-img-element */

"use client";

import { format } from "date-fns";
import { ExternalLink, LoaderCircle, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SpotifyUserLink } from "@/components/spotify-user-link";
import type { ActiveSongsSortBy, SortDirection } from "@/lib/services/stats-service";
import { cn, compactSearchText, formatRelativeDuration, getPlaylistStartDate, normalizeSearchText } from "@/lib/utils";

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
  contributorImageUrl?: string | null;
  commentCount?: number;
  addedAt: Date | null;
  firstSeenAt: Date;
  spotifyUrl: string;
  spotifyUri: string;
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
  const [eventTrackId, setEventTrackId] = useState<string | null>(null);
  const [playPendingTrackId, setPlayPendingTrackId] = useState<string | null>(null);
  const [playErrorTrackId, setPlayErrorTrackId] = useState<string | null>(null);

  useEffect(() => {
    function handleTrackChange(event: Event) {
      const detail = (event as CustomEvent<{ trackId?: string | null }>).detail;
      setEventTrackId(detail?.trackId ?? null);
    }

    window.addEventListener("fotm:now-playing-track", handleTrackChange as EventListener);
    return () => {
      window.removeEventListener("fotm:now-playing-track", handleTrackChange as EventListener);
    };
  }, []);

  const activeTrackId = eventTrackId ?? nowPlayingTrackId ?? null;

  async function handlePlayTrack(row: SongTableRow) {
    setPlayPendingTrackId(row.spotifyTrackId);
    setPlayErrorTrackId(null);

    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "play",
          trackUri: row.spotifyUri,
        }),
      });

      await response.json().catch(() => null);

      if (!response.ok) {
        setPlayErrorTrackId(row.spotifyTrackId);
        return;
      }

      setEventTrackId(row.spotifyTrackId);
      window.dispatchEvent(
        new CustomEvent("fotm:now-playing-track", {
          detail: {
            trackId: row.spotifyTrackId,
          },
        }),
      );
      window.setTimeout(() => {
        void fetch("/api/spotify/now-playing", {
          cache: "no-store",
          credentials: "same-origin",
        }).catch(() => null);
      }, 250);
    } catch {
      setPlayErrorTrackId(row.spotifyTrackId);
    } finally {
      setPlayPendingTrackId(null);
    }
  }

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
          <col className="w-[28%]" />
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
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
            <th className="pb-2.5 pr-4">Comments</th>
            <SortableHeader
              label="Age"
              column="age"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
            <th className="pb-2.5 pr-0 text-right">Open</th>
          </tr>
        </thead>
        <tbody id="active-song-body" className="divide-y divide-white/6 text-stone-200">
          {rows.map((row) => {
            const searchValue = [
              row.title,
              row.titleRomanized ?? "",
              row.artists.join(" "),
              (row.artistsRomanized ?? []).join(" "),
              row.contributor ?? "",
              row.contributorSpotifyUserId ?? "",
            ].join(" ");
            const normalizedSearchValue = normalizeSearchText(searchValue);
            const compactSearchValue = compactSearchText(searchValue);
            const isNowPlaying = activeTrackId === row.spotifyTrackId;

            return (
              <tr
                key={row.id}
                data-song-row="true"
                data-search={searchValue}
                data-search-normalized={normalizedSearchValue}
                data-search-compact={compactSearchValue}
                className={cn(
                  "group/song transition-all duration-200 hover:bg-white/[0.035]",
                  isNowPlaying &&
                    "bg-[linear-gradient(90deg,rgba(243,167,92,0.14),rgba(243,167,92,0.06),rgba(106,161,109,0.12))] shadow-[inset_0_0_0_1px_rgba(243,167,92,0.18)]",
                )}
              >
                <td className="py-3 pr-4">
                  <div className="relative w-fit">
                    {row.artworkUrl ? (
                      <>
                        <img
                          src={row.artworkUrl}
                          alt=""
                          className={cn(
                            "h-10 w-10 rounded-xl object-cover transition duration-200 group-hover/song:brightness-[0.42]",
                            isNowPlaying && "ring-2 ring-[--color-accent]/85 ring-offset-2 ring-offset-[--color-ink] shadow-[0_0_24px_rgba(243,167,92,0.18)]",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => void handlePlayTrack(row)}
                          disabled={playPendingTrackId === row.spotifyTrackId}
                          className="absolute inset-0 inline-flex items-center justify-center rounded-xl bg-black/0 text-white opacity-0 transition duration-200 hover:bg-black/8 focus-visible:opacity-100 focus-visible:outline-none group-hover/song:opacity-100 disabled:cursor-progress"
                          aria-label={`Play ${row.title}`}
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 backdrop-blur-sm">
                            {playPendingTrackId === row.spotifyTrackId ? (
                              <LoaderCircle className="h-4 w-4 animate-spin text-[--color-accent]" />
                            ) : (
                              <Play className="h-4 w-4 fill-current text-white" />
                            )}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/6 text-[10px] text-stone-500 transition duration-200 group-hover/song:bg-white/10">
                          n/a
                        </div>
                        <button
                          type="button"
                          onClick={() => void handlePlayTrack(row)}
                          disabled={playPendingTrackId === row.spotifyTrackId}
                          className="absolute inset-0 inline-flex items-center justify-center rounded-xl bg-black/0 text-white opacity-0 transition duration-200 hover:bg-black/8 focus-visible:opacity-100 focus-visible:outline-none group-hover/song:opacity-100 disabled:cursor-progress"
                          aria-label={`Play ${row.title}`}
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 backdrop-blur-sm">
                            {playPendingTrackId === row.spotifyTrackId ? (
                              <LoaderCircle className="h-4 w-4 animate-spin text-[--color-accent]" />
                            ) : (
                              <Play className="h-4 w-4 fill-current text-white" />
                            )}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
                <td className="relative py-3 pr-4 font-medium text-stone-100">
                  {isNowPlaying ? (
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[--color-accent]">
                      Playing now
                    </p>
                  ) : null}
                  {isNowPlaying ? (
                    <div className="absolute inset-y-3 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(243,167,92,0.85),transparent)]" aria-hidden="true" />
                  ) : null}
                  {row.titleRomanized ? (
                    <p className="mb-0.5 truncate font-mono text-[8px] font-normal uppercase leading-[1.15] tracking-[0.04em] text-stone-300">
                      {row.titleRomanized}
                    </p>
                  ) : null}
                  <p className="min-w-0 truncate transition group-hover/song:text-white">
                    {row.title}
                  </p>
                  {playErrorTrackId === row.spotifyTrackId ? (
                    <p className="mt-1 text-[11px] text-rose-300">
                      Could not start playback. Open Spotify on an active device first.
                    </p>
                  ) : null}
                </td>
                <td className="py-3 pr-4">
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
                <td className="py-3 pr-4">
                  <SpotifyUserLink
                    name={row.contributor}
                    spotifyUserId={row.contributorSpotifyUserId}
                    profileUrl={row.contributorProfileUrl}
                    imageUrl={row.contributorImageUrl}
                    fallbackLabel="Unknown"
                    sizeClassName="h-7 w-7"
                    textClassName="truncate"
                  />
                </td>
                <td className="py-3 pr-4">
                  {row.addedAt ? format(row.addedAt, "MMM d, yyyy") : "Unknown"}
                </td>
                <td className="py-3 pr-4 text-stone-300">
                  {row.commentCount ?? 0}
                </td>
                <td className="py-3 pr-4">
                  {formatRelativeDuration(getPlaylistStartDate(row.addedAt, row.firstSeenAt))}
                </td>
                <td className="py-3 text-right">
                  <a
                    href={row.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-stone-400 transition hover:border-[--color-accent] hover:text-[--color-accent]"
                    aria-label={`Open ${row.title} in Spotify`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
