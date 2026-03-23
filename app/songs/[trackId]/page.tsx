/* eslint-disable @next/next/no-img-element */

import { format } from "date-fns";
import { notFound } from "next/navigation";

import { SongPageComments } from "@/components/song-page-comments";
import { SectionCard } from "@/components/section-card";
import { SpotifyUserLink } from "@/components/spotify-user-link";
import { StatCard } from "@/components/stat-card";
import { getNowPlayingTrack } from "@/lib/services/now-playing-service";
import { getSongPageData } from "@/lib/services/song-page-service";

type SongPageProps = {
  params: Promise<{
    trackId: string;
  }>;
};

export default async function SongPage({ params }: SongPageProps) {
  const { trackId } = await params;
  const [song, nowPlaying] = await Promise.all([
    getSongPageData(trackId),
    getNowPlayingTrack(),
  ]);

  if (!song) {
    notFound();
  }

  const matchesPlayback = nowPlaying?.spotifyTrackId === song.track.spotifyTrackId;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8">
      <SectionCard title="Song profile" eyebrow="Track detail">
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          {song.track.artworkUrl ? (
            <img
              src={song.track.artworkUrl}
              alt=""
              className="h-32 w-32 rounded-[2rem] object-cover"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-xs uppercase tracking-[0.22em] text-stone-500">
              No art
            </div>
          )}

          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[--color-accent]">
              {song.stats.isActive ? "Currently active" : "Archived track"}
            </p>
            {song.track.titleRomanized ? (
              <p className="mt-2 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-stone-400">
                {song.track.titleRomanized}
              </p>
            ) : null}
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-100 lg:text-5xl">
              {song.track.title}
            </h1>
            {song.track.artistsRomanized.some((artist, index) => artist && artist !== song.track.artists[index]) ? (
              <p className="mt-4 truncate font-mono text-sm text-stone-400">
                {song.track.artistsRomanized.join(", ")}
              </p>
            ) : null}
            <p className="text-xl text-stone-300">{song.track.artists.join(", ")}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-400">
              {song.track.albumName ? (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  Album: {song.track.albumName}
                </span>
              ) : null}
              {song.track.durationMs ? (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  {Math.floor(song.track.durationMs / 60000)}:{Math.floor((song.track.durationMs % 60000) / 1000)
                    .toString()
                    .padStart(2, "0")}
                </span>
              ) : null}
              {matchesPlayback ? (
                <span className="rounded-full border border-[--color-accent]/35 bg-[--color-accent]/10 px-3 py-1 text-[--color-accent]">
                  Playing now
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Likes" value={song.stats.likeScore} />
        <StatCard label="Comments" value={song.stats.commentCount} />
        <StatCard label="Playlist runs" value={song.stats.appearances} />
        <StatCard label="Contributors" value={song.stats.contributors} />
        <StatCard
          label="First seen"
          value={song.stats.firstSeenAt ? format(song.stats.firstSeenAt, "MMM d, yyyy") : "n/a"}
        />
        <StatCard label="Total lifetime" value={song.stats.totalLifetimeLabel} />
      </div>

      <SectionCard title="Comment timeline" eyebrow="Timestamped discussion">
        <SongPageComments
          track={song.track}
          commentPayload={song.comments}
          initialMatchesPlayback={matchesPlayback}
          initialProgressMs={matchesPlayback ? nowPlaying?.progressMs ?? 0 : 0}
          initialIsPlaying={matchesPlayback ? nowPlaying?.isPlaying ?? false : false}
          initialDeviceName={matchesPlayback ? nowPlaying?.deviceName ?? null : null}
        />
      </SectionCard>

      <SectionCard title="Playlist history" eyebrow="Lifecycle log">
        <div className="space-y-3">
          {song.lifecycles.map((lifecycle, index) => (
            <div
              key={lifecycle.id}
              className="flex flex-col gap-3 rounded-[1.4rem] border border-white/10 bg-black/10 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">
                  Run {song.lifecycles.length - index}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-300">
                  <span className={lifecycle.status === "ACTIVE" ? "text-emerald-300" : "text-stone-300"}>
                    {lifecycle.status === "ACTIVE" ? "Active" : "Removed"}
                  </span>
                  <span>•</span>
                  <span>{lifecycle.lifetimeLabel}</span>
                </div>
                <p className="mt-2 text-sm text-stone-400">
                  Added {lifecycle.addedAt ? format(lifecycle.addedAt, "MMM d, yyyy") : format(lifecycle.firstSeenAt, "MMM d, yyyy")}
                  {lifecycle.removedObservedAt ? ` • Removed ${format(lifecycle.removedObservedAt, "MMM d, yyyy")}` : ""}
                </p>
              </div>
              <div className="text-sm text-stone-300">
                {lifecycle.contributor ? (
                  <SpotifyUserLink
                    name={lifecycle.contributor}
                    profileUrl={lifecycle.contributorProfileUrl}
                    imageUrl={lifecycle.contributorImageUrl}
                    sizeClassName="h-6 w-6"
                  />
                ) : (
                  <span className="text-stone-500">Contributor unknown</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
