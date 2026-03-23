/* eslint-disable @next/next/no-img-element */

import { getSpotifyUserUrl } from "@/lib/utils";

type SpotifyUserLinkProps = {
  name: string | null | undefined;
  spotifyUserId?: string | null;
  profileUrl?: string | null;
  imageUrl?: string | null;
  className?: string;
  textClassName?: string;
  fallbackLabel?: string;
  sizeClassName?: string;
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function SpotifyUserLink({
  name,
  spotifyUserId,
  profileUrl,
  imageUrl,
  className = "",
  textClassName = "",
  fallbackLabel = "Unknown",
  sizeClassName = "h-7 w-7",
}: SpotifyUserLinkProps) {
  const label = name ?? spotifyUserId ?? fallbackLabel;
  const href = getSpotifyUserUrl(spotifyUserId, profileUrl);

  const avatar = imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className={`${sizeClassName} shrink-0 rounded-full object-cover ring-1 ring-white/12`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${sizeClassName} flex shrink-0 items-center justify-center rounded-full bg-white/8 font-mono text-[10px] uppercase tracking-[0.08em] text-stone-300 ring-1 ring-white/10`}
    >
      {getInitials(label)}
    </span>
  );

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      {avatar}
      <span className={textClassName}>{label}</span>
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center transition hover:text-[--color-accent]"
    >
      {content}
    </a>
  );
}
