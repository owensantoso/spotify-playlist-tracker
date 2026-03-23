/* eslint-disable @next/next/no-img-element */

"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { NowPlayingComments } from "@/components/now-playing-comments";
import type { CommentTrackPayload } from "@/lib/services/comment-service";
import type { NowPlayingTrack } from "@/lib/services/now-playing-service";
import { cn } from "@/lib/utils";

type NavigationProps = {
  playlistName: string;
  playlistUrl: string | null;
  nowPlaying: NowPlayingTrack | null;
  initialComments?: CommentTrackPayload;
};

type AuthStatus = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  spotifyUserId: string | null;
};

type NowPlayingResponse = {
  nowPlaying: NowPlayingTrack | null;
  comments: CommentTrackPayload;
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

export function Navigation({
  playlistName,
  playlistUrl,
  nowPlaying: initialNowPlaying,
  initialComments,
}: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    isAdmin: false,
    isViewer: false,
    spotifyUserId: null,
  });
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(initialNowPlaying);
  const [commentPayload, setCommentPayload] = useState<CommentTrackPayload>(
    initialComments ?? {
      featureAvailable: true,
      version: "0",
      markers: [],
      threads: [],
    },
  );
  const [progressMs, setProgressMs] = useState(initialNowPlaying?.progressMs ?? 0);
  const [controlPending, setControlPending] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const controlRequestRef = useRef(0);
  const nowPlayingTrackRef = useRef(initialNowPlaying?.spotifyTrackId ?? null);

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
    const nextTrackId = nextTrack?.spotifyTrackId ?? null;
    if (nowPlayingTrackRef.current !== nextTrackId) {
      nowPlayingTrackRef.current = nextTrackId;
      window.dispatchEvent(
        new CustomEvent("fotm:now-playing-track", {
          detail: {
            trackId: nextTrackId,
          },
        }),
      );
    }

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
        setCommentPayload({
          featureAvailable: true,
          version: "0",
          markers: [],
          threads: [],
        });
        return null;
      }

      if (!response.ok) {
        return nowPlaying;
      }

      const payload = (await response.json()) as NowPlayingResponse;
      syncNowPlaying(payload.nowPlaying);
      setCommentPayload(payload.comments);
      return payload.nowPlaying;
    } catch {
      // Keep the previous state during transient polling failures.
      return nowPlaying;
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
    const requestId = controlRequestRef.current + 1;
    controlRequestRef.current = requestId;
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
        | { ok?: boolean; nowPlaying?: NowPlayingTrack | null; error?: string; status?: number }
        | null;

      if (!response.ok) {
        if (controlRequestRef.current !== requestId) {
          return;
        }

        if (payload?.status === 403) {
          setControlError("Reconnect Spotify to grant playback control.");
        } else if (payload?.status === 409) {
          setControlError("Open Spotify on a device first.");
        }
        [300, 1100].forEach((delay) => {
          window.setTimeout(() => {
            if (controlRequestRef.current === requestId) {
              void loadNowPlaying();
            }
          }, delay);
        });
        return;
      }

      if (controlRequestRef.current !== requestId) {
        return;
      }

      if (payload && "nowPlaying" in payload) {
        syncNowPlaying(payload.nowPlaying ?? null);
      }
      [250, 950].forEach((delay) => {
        window.setTimeout(() => {
          if (controlRequestRef.current === requestId) {
            void loadNowPlaying();
          }
        }, delay);
      });
    } catch {
      if (controlRequestRef.current === requestId) {
        setControlError("Could not sync playback state.");
      }
    } finally {
      window.setTimeout(() => {
        if (controlRequestRef.current === requestId) {
          setControlPending(null);
        }
      }, 200);
    }
  }

  const visibleAdminLinks =
    authStatus.isAdmin || pathname.startsWith("/admin") || pathname === "/setup"
      ? adminLinks
      : [];

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
            {authStatus.isAuthenticated ? (
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-white/12 px-4 py-2 text-sm text-stone-200 transition hover:border-white/25 hover:text-white"
                >
                  Log out
                </button>
              </form>
            ) : (
              <a
                href={`/api/auth/spotify/login?mode=viewer&next=${encodeURIComponent(pathname || "/")}`}
                className="rounded-full border border-[--color-accent]/45 bg-[--color-accent]/10 px-4 py-2 text-sm text-[--color-accent] transition hover:bg-[--color-accent]/20"
              >
                Sign in with Spotify
              </a>
            )}
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
                  {nowPlaying?.titleRomanized ? (
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-stone-400">
                      {nowPlaying.titleRomanized}
                    </p>
                  ) : null}
                  <p className="truncate text-lg font-semibold text-stone-100">
                    {nowPlaying?.title ?? "Nothing is playing right now"}
                  </p>
                  {nowPlaying?.artistsRomanized?.some((artist, index) => artist && artist !== nowPlaying.artists[index]) ? (
                    <p className="truncate font-mono text-[10px] text-stone-400">
                      {nowPlaying.artistsRomanized.join(", ")}
                    </p>
                  ) : null}
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
                  className="rounded-full border border-white/12 p-3 text-stone-200 transition hover:border-[--color-accent] hover:text-white"
                  aria-label="Previous track"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void runPlayerAction(nowPlaying?.isPlaying ? "pause" : "play")}
                  className="rounded-full border border-[--color-accent]/60 bg-[--color-accent]/10 p-3 text-[--color-accent] transition hover:bg-[--color-accent]/20"
                  aria-label={nowPlaying?.isPlaying ? "Pause playback" : "Resume playback"}
                >
                  {nowPlaying?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void runPlayerAction("next")}
                  className="rounded-full border border-white/12 p-3 text-stone-200 transition hover:border-[--color-accent] hover:text-white"
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

            <NowPlayingComments
              track={nowPlaying}
              progressMs={progressMs}
              authStatus={authStatus}
              controlStatusLabel={controlError ?? (controlPending ? "Syncing playback..." : "")}
              onRefreshNowPlaying={loadNowPlaying}
              commentPayload={commentPayload}
            />
          </div>
        ) : (
          <div className="rounded-[1.8rem] border border-white/10 bg-black/10 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[--color-accent]">
                  Personal now playing
                </p>
                <p className="text-lg font-semibold text-stone-100">
                  Sign in with Spotify to see your own current track here.
                </p>
                <p className="text-sm text-stone-400">
                  Your Spotify account is saved in the app database so future user-specific features can build on it.
                </p>
              </div>
              <a
                href={`/api/auth/spotify/login?mode=viewer&next=${encodeURIComponent(pathname || "/")}`}
                className="w-fit rounded-full border border-[--color-accent]/45 bg-[--color-accent]/10 px-4 py-2 text-sm text-[--color-accent] transition hover:bg-[--color-accent]/20"
              >
                Sign in with Spotify
              </a>
            </div>
            <NowPlayingComments
              track={nowPlaying}
              progressMs={progressMs}
              authStatus={authStatus}
              controlStatusLabel="Read-only"
              onRefreshNowPlaying={loadNowPlaying}
              commentPayload={commentPayload}
            />
          </div>
        )}
      </div>
    </header>
  );
}
