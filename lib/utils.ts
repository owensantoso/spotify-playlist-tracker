import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDuration(date: Date) {
  return formatDistanceToNowStrict(date, { addSuffix: false, unit: "day" }) === "0 days"
    ? formatDistanceToNowStrict(date, { addSuffix: false })
    : formatDistanceToNowStrict(date, { addSuffix: false, unit: "day" });
}

export function getPlaylistStartDate(addedAt: Date | null | undefined, fallback: Date) {
  return addedAt ?? fallback;
}

export function getSpotifyUserUrl(spotifyUserId: string | null | undefined, profileUrl?: string | null) {
  if (profileUrl) {
    return profileUrl;
  }

  if (!spotifyUserId) {
    return null;
  }

  return `https://open.spotify.com/user/${spotifyUserId}`;
}

export function formatLifetimeMs(durationMs: number | null | undefined) {
  if (durationMs == null) {
    return "n/a";
  }

  const totalDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
  if (totalDays >= 60) {
    const months = Math.round(totalDays / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  if (totalDays >= 1) {
    return `${totalDays} day${totalDays === 1 ? "" : "s"}`;
  }

  const totalHours = Math.max(1, Math.floor(durationMs / (1000 * 60 * 60)));
  return `${totalHours} hour${totalHours === 1 ? "" : "s"}`;
}

export function absoluteUrl(pathname: string) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return new URL(pathname, base).toString();
}

export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function compactSearchText(value: string | null | undefined) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}
