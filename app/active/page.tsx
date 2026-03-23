export const dynamic = "force-dynamic";

import { SongTable } from "@/components/song-table";
import { SectionCard } from "@/components/section-card";
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
  const rows = await getActiveSongs({
    sortBy,
    sortDirection,
  });

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
            artworkUrl: row.track.artworkUrl,
            title: row.track.name,
            titleRomanized: row.track.nameRomanized,
            artists: row.track.artistNames,
            artistsRomanized: row.track.artistNamesRomanized,
            artistSpotifyUrls: row.track.artistSpotifyUrls,
            contributor: row.addedBy?.displayName ?? row.addedBySpotifyUserId ?? null,
            contributorSpotifyUserId: row.addedBySpotifyUserId,
            contributorProfileUrl: row.addedBy?.profileUrl ?? null,
            addedAt: row.spotifyAddedAt,
            firstSeenAt: row.firstSeenAt,
            spotifyUrl: row.track.spotifyUrl,
          }))}
          searchQuery={q ?? ""}
          sortBy={sortBy}
          sortDirection={sortDirection}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                window.filterActiveSongs = () => {
                  const input = document.getElementById("active-search-input");
                  const rows = Array.from(document.querySelectorAll("[data-song-row]"));
                  const empty = document.getElementById("active-song-empty");
                  const tbody = document.getElementById("active-song-body");

                  if (!(input instanceof HTMLInputElement)) {
                    console.debug("[active-search] missing input");
                    return;
                  }

                  const query = input.value.trim().toLowerCase();
                  let visibleCount = 0;

                  rows.forEach((row) => {
                    if (!(row instanceof HTMLElement)) return;
                    const haystack = row.dataset.search ?? "";
                    const visible = !query || haystack.includes(query);
                    row.style.display = visible ? "" : "none";
                    if (visible) visibleCount += 1;
                  });

                  if (empty instanceof HTMLElement) {
                    empty.style.display = visibleCount === 0 ? "" : "none";
                  }

                  if (tbody instanceof HTMLElement) {
                    tbody.style.display = visibleCount === 0 ? "none" : "";
                  }

                  console.debug("[active-search]", { query, rows: rows.length, visibleCount });
                };

                const input = document.getElementById("active-search-input");
                if (input instanceof HTMLInputElement) {
                  input.addEventListener("input", () => window.filterActiveSongs());
                }

                if (document.readyState === "loading") {
                  document.addEventListener("DOMContentLoaded", () => window.filterActiveSongs());
                } else {
                  window.filterActiveSongs();
                }
              })();
            `,
          }}
        />
      </SectionCard>
    </div>
  );
}
