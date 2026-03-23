/* eslint-disable @next/next/no-img-element */

import { format } from "date-fns";

import { formatLifetimeMs, formatRelativeDuration, getPlaylistStartDate, getSpotifyUserUrl } from "@/lib/utils";

type SongListItem = {
  id: string;
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
  addedAt: Date | null;
  firstSeenAt: Date;
  removedObservedAt?: Date | null;
};

type SongRowListProps = {
  items: SongListItem[];
  emptyLabel: string;
  showLifetime?: boolean;
};

export function SongRowList({ items, emptyLabel, showLifetime = false }: SongRowListProps) {
  if (!items.length) {
    return <p className="text-sm text-stone-400">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-black/10 p-3.5 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-3">
            <a href={item.spotifyUrl} target="_blank" rel="noreferrer" className="block w-fit">
              {item.artworkUrl ? (
                <img
                  src={item.artworkUrl}
                  alt=""
                  className="h-12 w-12 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-xs text-stone-400">
                  No art
                </div>
              )}
            </a>
            <div>
              {item.titleRomanized ? (
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-stone-400">{item.titleRomanized}</p>
              ) : null}
              <a
                href={item.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-stone-100 transition hover:text-[--color-accent] md:text-[15px]"
              >
                {item.title}
              </a>
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
                {item.contributor ? (
                  <>
                    Added by{" "}
                    {getSpotifyUserUrl(item.contributorSpotifyUserId, item.contributorProfileUrl) ? (
                      <a
                        href={getSpotifyUserUrl(item.contributorSpotifyUserId, item.contributorProfileUrl)!}
                        target="_blank"
                        rel="noreferrer"
                        className="transition hover:text-[--color-accent]"
                      >
                        {item.contributor}
                      </a>
                    ) : (
                      item.contributor
                    )}
                  </>
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
      ))}
    </div>
  );
}
