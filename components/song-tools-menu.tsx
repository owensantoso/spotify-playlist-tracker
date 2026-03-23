"use client";

import { Check, Copy, Ellipsis } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SongToolsMenuProps = {
  title: string;
  artists: string[];
  className?: string;
  revealClassName?: string;
  panelClassName?: string;
};

function getGoogleSearchUrl(parts: string[]) {
  return `https://www.google.com/search?q=${encodeURIComponent(parts.filter(Boolean).join(" "))}`;
}

export function SongToolsMenu({
  title,
  artists,
  className,
  revealClassName,
  panelClassName,
}: SongToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"title" | "artists" | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const artistLabel = artists.join(", ");

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  async function handleCopy(value: string, key: "title" | "artists") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1200);
    } catch {
      setCopiedKey(null);
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute right-0 top-0 z-20 opacity-0 transition duration-150 group-hover/song-tools:opacity-100 group-focus-within/song-tools:opacity-100",
        "pointer-events-none group-hover/song-tools:pointer-events-auto group-focus-within/song-tools:pointer-events-auto",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[rgba(12,18,15,0.94)] text-stone-300 transition hover:border-[--color-accent] hover:text-white",
          revealClassName,
        )}
        aria-label="Song tools"
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 min-w-[12rem] rounded-2xl border border-white/10 bg-[rgba(10,16,13,0.98)] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.36)] backdrop-blur",
            panelClassName,
          )}
        >
          <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500">
            Copy
          </p>
          <button
            type="button"
            onClick={() => void handleCopy(title, "title")}
            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm text-stone-200 transition hover:bg-white/5 hover:text-white"
          >
            <span>Song title</span>
            {copiedKey === "title" ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy(artistLabel, "artists")}
            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm text-stone-200 transition hover:bg-white/5 hover:text-white"
          >
            <span>Artist name</span>
            {copiedKey === "artists" ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
          </button>
          <div className="mt-2 border-t border-white/8 pt-2">
            <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500">
              Chords search
            </p>
            {[
              { label: "Chords", term: "chords" },
              { label: "食谱", term: "食谱" },
              { label: "コード", term: "コード" },
            ].map((item) => (
              <a
                key={item.label}
                href={getGoogleSearchUrl([title, artistLabel, item.term])}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm text-stone-200 transition hover:bg-white/5 hover:text-white"
              >
                <span>{item.label}</span>
              </a>
            ))}
          </div>
          <div className="mt-2 border-t border-white/8 pt-2">
            <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500">
              Lyrics search
            </p>
            {[
              { label: "Lyrics", term: "lyrics" },
              { label: "Pinyin lyrics", term: "pinyin lyrics" },
              { label: "Romaji lyrics", term: "romaji lyrics" },
            ].map((item) => (
              <a
                key={item.label}
                href={getGoogleSearchUrl([title, artistLabel, item.term])}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm text-stone-200 transition hover:bg-white/5 hover:text-white"
              >
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
