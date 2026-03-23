/* eslint-disable @next/next/no-img-element */

"use client";

import { format } from "date-fns";
import { ExternalLink, Heart, LoaderCircle, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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
  likeScore?: number;
  viewerReaction?: SongReactionKind | null;
  addedAt: Date | null;
  firstSeenAt: Date;
  spotifyUrl: string;
  spotifyUri: string;
};

type SongReactionKind = "LIKE" | "SUPERLIKE";

type SongTableProps = {
  rows: SongTableRow[];
  searchQuery?: string;
  sortBy: ActiveSongsSortBy;
  sortDirection: SortDirection;
  nowPlayingTrackId?: string | null;
  reactionsFeatureAvailable?: boolean;
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
  reactionsFeatureAvailable = true,
}: SongTableProps) {
  const pathname = usePathname();
  const [eventTrackId, setEventTrackId] = useState<string | null>(null);
  const [playPendingTrackId, setPlayPendingTrackId] = useState<string | null>(null);
  const [playErrorTrackId, setPlayErrorTrackId] = useState<string | null>(null);
  const [reactionState, setReactionState] = useState<Record<string, { score: number; viewerReaction: SongReactionKind | null }>>(
    () =>
      rows.reduce<Record<string, { score: number; viewerReaction: SongReactionKind | null }>>((acc, row) => {
        acc[row.spotifyTrackId] = {
          score: row.likeScore ?? 0,
          viewerReaction: row.viewerReaction ?? null,
        };
        return acc;
      }, {}),
  );
  const [holdTrackId, setHoldTrackId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

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
  const displayRows = useMemo(() => {
    const nextRows = rows.map((row) => ({
      ...row,
      likeScore: reactionState[row.spotifyTrackId]?.score ?? row.likeScore ?? 0,
      viewerReaction: reactionState[row.spotifyTrackId]?.viewerReaction ?? row.viewerReaction ?? null,
    }));

    if (sortBy !== "likes") {
      return nextRows;
    }

    return [...nextRows].sort((left, right) => {
      const delta = (left.likeScore ?? 0) - (right.likeScore ?? 0);
      if (delta !== 0) {
        return sortDirection === "asc" ? delta : -delta;
      }

      return left.title.localeCompare(right.title);
    });
  }, [reactionState, rows, sortBy, sortDirection]);

  useEffect(() => {
    setReactionState(
      rows.reduce<Record<string, { score: number; viewerReaction: SongReactionKind | null }>>((acc, row) => {
        acc[row.spotifyTrackId] = {
          score: row.likeScore ?? 0,
          viewerReaction: row.viewerReaction ?? null,
        };
        return acc;
      }, {}),
    );
  }, [rows]);

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
      [450, 1200].forEach((delayMs) => {
        window.dispatchEvent(
          new CustomEvent("fotm:refresh-now-playing", {
            detail: { delayMs },
          }),
        );
      });
    } catch {
      setPlayErrorTrackId(row.spotifyTrackId);
    } finally {
      setPlayPendingTrackId(null);
    }
  }

  async function handleReaction(row: SongTableRow, kind: SongReactionKind) {
    if (!reactionsFeatureAvailable) {
      return;
    }

    const previous = reactionState[row.spotifyTrackId] ?? {
      score: row.likeScore ?? 0,
      viewerReaction: row.viewerReaction ?? null,
    };

    const nextViewerReaction = previous.viewerReaction === kind ? null : kind;
    const nextScore =
      previous.score -
      (previous.viewerReaction === "SUPERLIKE" ? 2 : previous.viewerReaction === "LIKE" ? 1 : 0) +
      (nextViewerReaction === "SUPERLIKE" ? 2 : nextViewerReaction === "LIKE" ? 1 : 0);

    setReactionState((current) => ({
      ...current,
      [row.spotifyTrackId]: {
        score: nextScore,
        viewerReaction: nextViewerReaction,
      },
    }));

    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          trackSpotifyId: row.spotifyTrackId,
          kind,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; score?: number; viewerReaction?: SongReactionKind | null; code?: string }
        | null;
      const confirmedScore = payload?.score;
      const confirmedViewerReaction = payload?.viewerReaction ?? null;

      if (response.status === 401) {
        window.location.href = `/api/auth/spotify/login?mode=viewer&next=${encodeURIComponent(pathname || "/active")}`;
        return;
      }

      if (!response.ok || typeof confirmedScore !== "number") {
        setReactionState((current) => ({
          ...current,
          [row.spotifyTrackId]: previous,
        }));
        return;
      }

      setReactionState((current) => ({
        ...current,
        [row.spotifyTrackId]: {
          score: confirmedScore,
          viewerReaction: confirmedViewerReaction,
        },
      }));
    } catch {
      setReactionState((current) => ({
        ...current,
        [row.spotifyTrackId]: previous,
      }));
    }
  }

  function clearLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHoldTrackId(null);
  }

  function beginLongPress(row: SongTableRow) {
    clearLongPress();
    longPressTriggeredRef.current = false;
    setHoldTrackId(row.spotifyTrackId);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setHoldTrackId(row.spotifyTrackId);
      void handleReaction(row, "SUPERLIKE");
      window.setTimeout(() => {
        setHoldTrackId((current) => (current === row.spotifyTrackId ? null : current));
      }, 240);
    }, 520);
  }

  function finishLongPress(row: SongTableRow) {
    const didTrigger = longPressTriggeredRef.current;
    clearLongPress();
    longPressTriggeredRef.current = false;

    if (!didTrigger) {
      void handleReaction(row, "LIKE");
    }
  }

  if (!displayRows.length) {
    return <p className="text-sm text-stone-400">No active songs match this view yet.</p>;
  }

  return (
    <div className="overflow-x-hidden">
      <p id="active-song-empty" className="hidden text-sm text-stone-400">
        No active songs match this view yet.
      </p>
      <table className="min-w-full table-separate border-spacing-y-2 text-left text-[13px]">
        <colgroup>
          <col className="w-[11%]" />
          <col className="w-[80px]" />
          <col className="w-[23%]" />
          <col className="w-[18%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[7%]" />
          <col className="w-[9%]" />
          <col className="w-[6%]" />
        </colgroup>
        <thead className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
          <tr>
            <SortableHeader
              label="Likes"
              column="likes"
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
            />
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
        <tbody id="active-song-body" className="text-stone-200">
          {displayRows.map((row) => {
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
            const currentReaction = reactionState[row.spotifyTrackId]?.viewerReaction ?? row.viewerReaction ?? null;
            const likeScore = reactionState[row.spotifyTrackId]?.score ?? row.likeScore ?? 0;
            const isHolding = holdTrackId === row.spotifyTrackId;
            const isSuperLiked = currentReaction === "SUPERLIKE";
            const isLiked = currentReaction === "LIKE";
            const centerCellClass = isNowPlaying
              ? "bg-[rgba(243,167,92,0.055)]"
              : "group-hover/song:bg-white/[0.035]";
            const leftEdgeCellClass = isNowPlaying
              ? "rounded-l-[1.4rem] bg-[linear-gradient(90deg,rgba(243,167,92,0.14),rgba(243,167,92,0.055))] pl-4"
              : "rounded-l-[1.4rem] group-hover/song:bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.035))] pl-4";
            const rightEdgeCellClass = isNowPlaying
              ? "rounded-r-[1.4rem] bg-[linear-gradient(90deg,rgba(243,167,92,0.055),rgba(106,161,109,0.12))] pr-4"
              : "rounded-r-[1.4rem] group-hover/song:bg-[linear-gradient(90deg,rgba(255,255,255,0.035),rgba(255,255,255,0.045))] pr-4";

            return (
              <tr
                key={row.id}
                data-song-row="true"
                data-search={searchValue}
                data-search-normalized={normalizedSearchValue}
                data-search-compact={compactSearchValue}
                className={cn(
                  "group/song transition-all duration-200",
                )}
              >
                <td
                  className={cn(
                    "py-3 pr-4",
                    leftEdgeCellClass,
                  )}
                >
                  <div className="flex min-w-[7.5rem] items-center gap-2">
                    <button
                      type="button"
                      onPointerDown={() => beginLongPress(row)}
                      onPointerUp={() => finishLongPress(row)}
                      onPointerLeave={clearLongPress}
                      onPointerCancel={clearLongPress}
                      onClick={(event) => event.preventDefault()}
                      disabled={!reactionsFeatureAvailable}
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition duration-200 disabled:opacity-60",
                        isSuperLiked
                          ? "border-[#ffd76a] bg-[#ffd76a]/16 text-[#ffe38f] shadow-[0_0_22px_rgba(255,215,106,0.18)]"
                          : isLiked
                            ? "border-emerald-400/45 bg-emerald-400/8 text-emerald-200"
                            : "border-white/10 text-stone-400 hover:border-[--color-accent]/50 hover:text-stone-100",
                        isHolding && "scale-110 animate-pulse shadow-[0_0_26px_rgba(243,167,92,0.28)]",
                      )}
                      aria-label={isHolding ? `Super-like ${row.title}` : `Like ${row.title}`}
                      title="Tap for like, hold for super-like"
                    >
                      {isSuperLiked || isHolding ? (
                        <Sparkles className={cn("h-4 w-4", isHolding && "rotate-6")} />
                      ) : (
                        <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                      )}
                    </button>
                    <div className="w-[4.5rem]">
                      <p className="text-sm font-medium text-stone-100">{likeScore}</p>
                      <p className="h-[1rem] overflow-hidden font-mono text-[9px] uppercase tracking-[0.12em] text-stone-500">
                        {isHolding ? "Super-like" : isSuperLiked ? "Super" : isLiked ? "Liked" : "Like"}
                      </p>
                    </div>
                  </div>
                </td>
                <td
                  className={cn(
                    "py-3 pr-4",
                    centerCellClass,
                  )}
                >
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
                <td
                  className={cn(
                    "relative py-3 pr-4 font-medium text-stone-100",
                    centerCellClass,
                  )}
                >
                  {isNowPlaying ? (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden="true">
                        <span className="fotm-eq-bar h-[6px] w-[2px] rounded-full bg-[--color-accent]" style={{ animationDelay: "0ms" }} />
                        <span className="fotm-eq-bar h-[10px] w-[2px] rounded-full bg-[--color-accent]" style={{ animationDelay: "140ms" }} />
                        <span className="fotm-eq-bar h-[7px] w-[2px] rounded-full bg-[--color-accent]" style={{ animationDelay: "280ms" }} />
                      </span>
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[--color-accent]">
                        Playing now
                      </p>
                    </div>
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
                <td
                  className={cn(
                    "py-3 pr-4",
                    centerCellClass,
                  )}
                >
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
                <td
                  className={cn(
                    "py-3 pr-4",
                    centerCellClass,
                  )}
                >
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
                <td
                  className={cn(
                    "py-3 pr-4",
                    centerCellClass,
                  )}
                >
                  {row.addedAt ? format(row.addedAt, "MMM d, yyyy") : "Unknown"}
                </td>
                <td
                  className={cn(
                    "py-3 pr-4 text-stone-300",
                    centerCellClass,
                  )}
                >
                  {row.commentCount ?? 0}
                </td>
                <td
                  className={cn(
                    "py-3 pr-4",
                    centerCellClass,
                  )}
                >
                  {formatRelativeDuration(getPlaylistStartDate(row.addedAt, row.firstSeenAt))}
                </td>
                <td
                  className={cn(
                    "py-3 text-right",
                    rightEdgeCellClass,
                  )}
                >
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
