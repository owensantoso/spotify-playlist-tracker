import Link from "next/link";

import { SpotifyUserLink } from "@/components/spotify-user-link";
import { SectionCard } from "@/components/section-card";
import { getSpotifyUserAvatarMap } from "@/lib/services/spotify-user-service";
import { getContributorLeaderboard, getLongestLastingSongs } from "@/lib/services/stats-service";
import { formatLifetimeMs } from "@/lib/utils";

export default async function ContributorsPage() {
  const [contributors, longestLasting] = await Promise.all([
    getContributorLeaderboard(),
    getLongestLastingSongs(10),
  ]);
  const contributorAvatars = await getSpotifyUserAvatarMap([
    ...contributors.map((contributor) => contributor.spotifyUserId),
    ...longestLasting.map(({ lifecycle }) => lifecycle.addedBySpotifyUserId),
  ]);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard title="Contributor leaderboard" eyebrow="Who shapes the mix">
        {!contributors.length ? (
          <p className="text-sm text-stone-400">No contributor history has been captured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.22em] text-stone-500">
                <tr>
                  <th className="pb-3 pr-4">Contributor</th>
                  <th className="pb-3 pr-4">Total songs</th>
                  <th className="pb-3 pr-4">Active now</th>
                  <th className="pb-3">Avg lifetime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-stone-200">
                {contributors.map((contributor) => (
                  <tr key={contributor.spotifyUserId}>
                    <td className="py-4 pr-4">
                      <SpotifyUserLink
                        name={contributor.displayName}
                        spotifyUserId={contributor.spotifyUserId}
                        profileUrl={contributor.profileUrl}
                        imageUrl={contributorAvatars[contributor.spotifyUserId] ?? null}
                        sizeClassName="h-8 w-8"
                        textClassName="font-medium text-stone-100"
                      />
                    </td>
                    <td className="py-4 pr-4">{contributor.totalSongs}</td>
                    <td className="py-4 pr-4">{contributor.activeSongs}</td>
                    <td className="py-4">{contributor.averageLifetimeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Longest-lasting songs" eyebrow="All-time tenure">
        <div className="space-y-3">
          {longestLasting.map(({ lifecycle, lifetimeMs }) => (
            <div key={lifecycle.id} className="rounded-3xl border border-white/8 bg-black/10 p-4">
              {lifecycle.track.nameRomanized ? (
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-stone-400">
                  {lifecycle.track.nameRomanized}
                </p>
              ) : null}
              <Link
                href={`/songs/${encodeURIComponent(lifecycle.track.spotifyTrackId)}`}
                className="font-medium leading-tight text-stone-100 transition hover:text-[--color-accent]"
              >
                {lifecycle.track.name}
              </Link>
              {lifecycle.track.artistNamesRomanized.some((artist, index) => artist && artist !== lifecycle.track.artistNames[index]) ? (
                <p className="font-mono text-[9px] text-stone-400">
                  {lifecycle.track.artistNamesRomanized.join(", ")}
                </p>
              ) : null}
              <p className="text-sm text-stone-300">
                {lifecycle.track.artistNames.map((artist, index) => (
                  <span key={`${lifecycle.id}-${artist}-${index}`}>
                    <a
                      href={lifecycle.track.artistSpotifyUrls[index] || `https://open.spotify.com/search/${encodeURIComponent(artist)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="transition hover:text-[--color-accent]"
                    >
                      {artist}
                    </a>
                    {index < lifecycle.track.artistNames.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
              <p className="text-xs text-stone-500">
                {lifecycle.addedBy?.displayName || lifecycle.addedBySpotifyUserId ? (
                  <span className="inline-flex items-center gap-2">
                    <span>Added by</span>
                    <SpotifyUserLink
                      name={lifecycle.addedBy?.displayName ?? lifecycle.addedBySpotifyUserId}
                      spotifyUserId={lifecycle.addedBySpotifyUserId}
                      profileUrl={lifecycle.addedBy?.profileUrl ?? null}
                      imageUrl={
                        lifecycle.addedBySpotifyUserId
                          ? contributorAvatars[lifecycle.addedBySpotifyUserId] ?? null
                          : null
                      }
                      sizeClassName="h-6 w-6"
                    />
                  </span>
                ) : (
                  "Contributor unknown"
                )}
              </p>
              <p className="mt-2 text-sm text-stone-400">{formatLifetimeMs(lifetimeMs)}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
