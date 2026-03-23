export const dynamic = "force-dynamic";

import { SectionCard } from "@/components/section-card";
import { SongRowList } from "@/components/song-row-list";
import { getRecentHistory } from "@/lib/services/stats-service";

export default async function HistoryPage() {
  const history = await getRecentHistory(20);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 xl:grid-cols-2">
      <SectionCard title="Recent additions" eyebrow="Newest arrivals">
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
          emptyLabel="No additions yet."
        />
      </SectionCard>

      <SectionCard title="Recent removals" eyebrow="Recently rotated out">
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
          emptyLabel="No removals yet."
          showLifetime
        />
      </SectionCard>
    </div>
  );
}
