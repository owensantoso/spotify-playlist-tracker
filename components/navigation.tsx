/* eslint-disable @next/next/no-img-element */

"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import type { NowPlayingTrack } from "@/lib/services/now-playing-service";
import { cn } from "@/lib/utils";

type NavigationProps = {
  playlistName: string;
  playlistUrl: string | null;
  nowPlaying: NowPlayingTrack | null;
};

type AuthStatus = {
  isAuthenticated: boolean;
};

type NowPlayingResponse = {
  nowPlaying: NowPlayingTrack | null;
  fetchedAt: number;
};

const publicLinks = [
  { href: "/", label: "Overview" },
  { href: "/active", label: "Active songs" },
  { href: "/history", label: "History" },
  { href: "/contributors", label: "Contributors" },
];

const adminLinks = [
  { href: "/setup", label: "Setup" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
];

const prefetchedRoutes = [...publicLinks, ...adminLinks].map((link) => link.href);
const NOW_PLAYING_POLL_MS = 5000;
const PROGRESS_TICK_MS = 250;

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Navigation({ playlistName, playlistUrl, nowPlaying: initialNowPlaying }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isAuthenticated: false });
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(initialNowPlaying);
  const [progressMs, setProgressMs] = useState(initialNowPlaying?.progressMs ?? 0);
  const [controlPending, setControlPending] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  useEffect(() => {
    prefetchedRoutes.forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const response = await fetch("/api/auth/status", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          return;
        }

        const nextStatus = (await response.json()) as AuthStatus;
        if (!cancelled) {
          setAuthStatus(nextStatus);
        }
      } catch {
        // Keep the last known auth state if the status probe fails.
      }
    }

    void loadAuthStatus();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function syncNowPlaying(nextTrack: NowPlayingTrack | null) {
    setNowPlaying(nextTrack);
    setProgressMs(nextTrack?.progressMs ?? 0);
    setControlError(null);
  }

  async function loadNowPlaying() {
    try {
      const response = await fetch("/api/spotify/now-playing", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 401) {
        syncNowPlaying(null);
        return;
      }

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as NowPlayingResponse;
      syncNowPlaying(payload.nowPlaying);
    } catch {
      // Keep the previous state during transient polling failures.
    }
  }

  const pollNowPlaying = useEffectEvent(async () => {
    await loadNowPlaying();
  });

  useEffect(() => {
    if (!authStatus.isAuthenticated) {
      syncNowPlaying(null);
      return;
    }

    void pollNowPlaying();
    const interval = window.setInterval(() => {
      void pollNowPlaying();
    }, NOW_PLAYING_POLL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [authStatus.isAuthenticated]);

  useEffect(() => {
    if (!nowPlaying?.isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgressMs((current) => {
        const duration = nowPlaying.durationMs ?? current + PROGRESS_TICK_MS;
        return Math.min(current + PROGRESS_TICK_MS, duration);
      });
    }, PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [nowPlaying?.durationMs, nowPlaying?.isPlaying, nowPlaying?.spotifyTrackId]);

  async function runPlayerAction(action: "play" | "pause" | "next" | "previous") {
    setControlPending(action);
    setControlError(null);

    try {
      const response = await fetch("/api/spotify/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ action }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { nowPlaying?: NowPlayingTrack | null; error?: string; status?: number }
        | null;

      if (!response.ok) {
        setControlError(
          payload?.status === 403
            ? "Reconnect Spotify to grant playback control."
            : payload?.status === 409
              ? "Open Spotify on a device first."
              : payload?.error ?? "Playback control failed.",
        );
        return;
      }

      syncNowPlaying(payload?.nowPlaying ?? null);
      window.setTimeout(() => {
        void loadNowPlaying();
      }, 800);
    } catch {
      setControlError("Playback control failed.");
    } finally {
      setControlPending(null);
    }
  }

  const visibleAdminLinks =
    authStatus.isAuthenticated || pathname.startsWith("/admin") || pathname === "/setup"
      ? adminLinks
      : [];

  const progressPercent = useMemo(() => {
    if (!nowPlaying?.durationMs || nowPlaying.durationMs <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (progressMs / nowPlaying.durationMs) * 100));
  }, [nowPlaying?.durationMs, progressMs]);

  return (
    <header className="border-b border-white/10 bg-[rgba(15,23,20,0.86)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[--color-accent]">
              Main playlist
            </p>
            {playlistUrl ? (
              <a
                href={playlistUrl}
                target="_blank"
                rel="noreferrer"
                className="text-2xl font-semibold tracking-tight text-stone-100 transition hover:text-[--color-accent]"
              >
                {playlistName}
              </a>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight text-stone-100">{playlistName}</h1>
            )}
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {publicLinks.map((link) => {
              const isActive = isCurrentPath(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(link.href)}
                  onFocus={() => router.prefetch(link.href)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    isActive
                      ? "border-[--color-accent] bg-[--color-accent]/10 text-white"
                      : "border-white/10 text-stone-200 hover:border-[--color-accent] hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {visibleAdminLinks.map((link) => {
              const isActive = isCurrentPath(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(link.href)}
                  onFocus={() => router.prefetch(link.href)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    isActive
                      ? "border border-[--color-accent] bg-[--color-accent] text-[--color-ink]"
                      : "border border-[--color-accent]/40 bg-[--color-accent]/10 text-[--color-accent] hover:bg-[--color-accent]/20",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {authStatus.isAuthenticated ? (
          <div className="rounded-[1.8rem] border border-white/12 bg-black/15 px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {nowPlaying?.artworkUrl ? (
                  <img
                    src={nowPlaying.artworkUrl}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.2em] text-stone-400">
                    Idle
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[--color-accent]">
                    {nowPlaying ? (nowPlaying.isPlaying ? "Now playing" : "Paused") : "Now playing"}
                  </p>
                  <p className="truncate text-lg font-semibold text-stone-100">
                    {nowPlaying?.title ?? "Nothing is playing right now"}
                  </p>
                  <p className="truncate text-sm text-stone-300">
                    {nowPlaying ? nowPlaying.artists.join(", ") || "Spotify" : "Start playback on Spotify and this bar will update automatically."}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    {nowPlaying?.deviceName
                      ? `Device: ${nowPlaying.deviceName}`
                      : nowPlaying?.albumName ?? "Polling Spotify every 5 seconds"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runPlayerAction("previous")}
                  disabled={controlPending !== null}
                  className="rounded-full border border-white/12 p-3 text-stone-200 transition hover:border-[--color-accent] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous track"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void runPlayerAction(nowPlaying?.isPlaying ? "pause" : "play")}
                  disabled={controlPending !== null}
                  className="rounded-full border border-[--color-accent]/60 bg-[--color-accent]/10 p-3 text-[--color-accent] transition hover:bg-[--color-accent]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={nowPlaying?.isPlaying ? "Pause playback" : "Resume playback"}
                >
                  {nowPlaying?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void runPlayerAction("next")}
                  disabled={controlPending !== null}
                  className="rounded-full border border-white/12 p-3 text-stone-200 transition hover:border-[--color-accent] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next track"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                {nowPlaying?.spotifyUrl ? (
                  <a
                    href={nowPlaying.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/12 px-4 py-2 text-sm text-stone-200 transition hover:border-[--color-accent] hover:text-white"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(243,167,92,0.92),rgba(106,161,109,0.95))] transition-[width] duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-stone-400">
                <span>{formatMs(progressMs)}</span>
                <span>{controlError ?? (controlPending ? "Updating Spotify..." : "Live poll: 5s")}</span>
                <span>{formatMs(nowPlaying?.durationMs ?? 0)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
