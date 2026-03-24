/* eslint-disable @next/next/no-img-element */

"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SpotifyUserLink } from "@/components/spotify-user-link";
import { cn, formatLifetimeMs, formatRelativeDuration, getPlaylistStartDate } from "@/lib/utils";

type SongListItem = {
  id: string;
  spotifyTrackId: string;
  title: string;
  titleRomanized?: string | null;
  artists: string[];
  artistsRomanized?: string[];
  artistSpotifyUrls: string[];
  artworkUrl: string | null;
  spotifyUrl: string;
  contributor: string | null;
  contributorSpotifyUserId?: string | null;
  contributorProfileUrl?: string | null;
  contributorImageUrl?: string | null;
  addedAt: Date | null;
  firstSeenAt: Date;
  removedObservedAt?: Date | null;
};

type SongRowListProps = {
  items: SongListItem[];
  emptyLabel: string;
  showLifetime?: boolean;
  nowPlayingTrackId?: string | null;
};

export function SongRowList({
  items,
  emptyLabel,
  showLifetime = false,
  nowPlayingTrackId,
}: SongRowListProps) {
  const [eventTrackId, setEventTrackId] = useState<string | null>(null);

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

  if (!items.length) {
    return <p className="text-sm text-stone-400">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const isNowPlaying = item.spotifyTrackId === activeTrackId;

        return (
          <div
            key={item.id}
            className={cn(
              "flex flex-col gap-3 rounded-3xl border border-white/8 bg-black/10 p-3.5 md:flex-row md:items-center md:justify-between",
              isNowPlaying && "border-[--color-accent]/50 bg-[--color-accent]/10 shadow-[0_0_0_1px_rgba(243,167,92,0.2)]",
            )}
          >
            <div className="flex items-center gap-3">
              <a href={item.spotifyUrl} target="_blank" rel="noreferrer" className="block w-fit">
                {item.artworkUrl ? (
                  <img
                    src={item.artworkUrl}
                    alt=""
                    className={cn(
                      "h-12 w-12 rounded-2xl object-cover",
                      isNowPlaying && "ring-2 ring-[--color-accent]/70 ring-offset-2 ring-offset-[--color-ink]",
                    )}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-xs text-stone-400">
                    No art
                  </div>
                )}
              </a>
              <div className="space-y-px">
                {isNowPlaying ? (
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[--color-accent]">Playing now</p>
                ) : null}
                {item.titleRomanized ? (
                  <p className="font-mono text-[9px] uppercase leading-none tracking-[0.08em] text-stone-400">{item.titleRomanized}</p>
                ) : null}
                <Link
                  href={`/songs/${encodeURIComponent(item.spotifyTrackId)}`}
                  className="text-sm font-medium leading-tight text-stone-100 transition hover:text-[--color-accent] md:text-[15px]"
                >
                  {item.title}
                </Link>
                {item.artistsRomanized?.some((artist, index) => artist && artist !== item.artists[index]) ? (
                  <p className="font-mono text-[9px] text-stone-400">
                    {item.artistsRomanized.map((artist, index) => (
                      <span key={`${item.id}-romanized-${artist}-${index}`}>
                        {artist}
                        {index < item.artistsRomanized!.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="text-sm text-stone-300">
                  {item.artists.map((artist, index) => (
                    <span key={`${item.id}-${artist}-${index}`}>
                      <a
                        href={item.artistSpotifyUrls[index] || `https://open.spotify.com/search/${encodeURIComponent(artist)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="transition hover:text-[--color-accent]"
                      >
                        {artist}
                      </a>
                      {index < item.artists.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
                <p className="text-xs text-stone-500">
                  {item.contributor || item.contributorSpotifyUserId ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span>Added by</span>
                      <SpotifyUserLink
                        name={item.contributor}
                        spotifyUserId={item.contributorSpotifyUserId}
                        profileUrl={item.contributorProfileUrl}
                        imageUrl={item.contributorImageUrl}
                        sizeClassName="h-5 w-5"
                      />
                    </span>
                  ) : (
                    "Contributor unknown"
                  )}
                </p>
              </div>
            </div>
            <div className="text-xs text-stone-400 md:text-right">
              <p>{item.addedAt ? format(item.addedAt, "MMM d, yyyy") : "Unknown add date"}</p>
              <p>{formatRelativeDuration(getPlaylistStartDate(item.addedAt, item.firstSeenAt))} in playlist</p>
              {showLifetime && item.removedObservedAt ? (
                <p>{formatLifetimeMs(item.removedObservedAt.getTime() - getPlaylistStartDate(item.addedAt, item.firstSeenAt).getTime())}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
