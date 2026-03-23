"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { compactSearchText, normalizeSearchText } from "@/lib/utils";

type ActiveSongsSearchControllerProps = {
  initialQuery?: string;
};

export function ActiveSongsSearchController({
  initialQuery = "",
}: ActiveSongsSearchControllerProps) {
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<string[]>(
    initialQuery.trim() ? [initialQuery.trim()] : [],
  );

  const activeTerms = useMemo(
    () => [...filters, ...(draft.trim() ? [draft.trim()] : [])],
    [draft, filters],
  );

  useEffect(() => {
    const input = document.getElementById("active-search-input");
    const empty = document.getElementById("active-song-empty");
    const tbody = document.getElementById("active-song-body");

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    function filterRows() {
      const rows = Array.from(document.querySelectorAll("[data-song-row]"));
      let visibleCount = 0;

      rows.forEach((row) => {
        if (!(row instanceof HTMLElement)) {
          return;
        }

        const rawHaystack = (row.dataset.search ?? "").toLocaleLowerCase();
        const normalizedHaystack = row.dataset.searchNormalized ?? normalizeSearchText(rawHaystack);
        const compactHaystack = row.dataset.searchCompact ?? compactSearchText(rawHaystack);
        const visible = activeTerms.every((term) => {
          const normalizedTerm = normalizeSearchText(term);
          const compactTerm = compactSearchText(term);
          const rawTerm = term.toLocaleLowerCase().trim();

          if (!normalizedTerm && !compactTerm && !rawTerm) {
            return true;
          }

          return (
            rawHaystack.includes(rawTerm) ||
            normalizedHaystack.includes(normalizedTerm) ||
            compactHaystack.includes(compactTerm)
          );
        });
        row.style.display = visible ? "" : "none";
        if (visible) {
          visibleCount += 1;
        }
      });

      if (empty instanceof HTMLElement) {
        empty.style.display = visibleCount === 0 ? "" : "none";
      }

      if (tbody instanceof HTMLElement) {
        tbody.style.display = visibleCount === 0 ? "none" : "";
      }
    }

    filterRows();
  }, [activeTerms]);

  function commitDraft() {
    const next = draft.trim();
    if (!next) {
      return;
    }

    const nextNormalized = compactSearchText(next);
    setFilters((current) => {
      if (current.some((item) => compactSearchText(item) === nextNormalized)) {
        return current;
      }

      return [...current, next];
    });
    setDraft("");
  }

  return (
    <div className="mb-4 space-y-3">
      <input
        id="active-search-input"
        type="search"
        value={draft}
        placeholder="Filter tracks, artists, romanized titles, or contributors"
        className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-2.5 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-[--color-accent]"
        aria-label="Filter active songs"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
            return;
          }

          if (event.key === "Backspace" && !draft && filters.length) {
            setFilters((current) => current.slice(0, -1));
          }
        }}
      />
      {filters.length ? (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <span
              key={filter}
              className="inline-flex items-center gap-2 rounded-[1.1rem] border border-[--color-accent]/30 bg-[--color-accent]/10 px-3 py-1.5 text-sm text-stone-100"
            >
              <span>{filter}</span>
              <button
                type="button"
                onClick={() =>
                  setFilters((current) => current.filter((item) => item !== filter))
                }
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-stone-300 transition hover:border-white/20 hover:text-white"
                aria-label={`Remove filter ${filter}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
