/* eslint-disable @next/next/no-img-element */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation({ playlistName, playlistUrl, nowPlaying }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isAuthenticated: false });

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

  const visibleAdminLinks =
    authStatus.isAuthenticated || pathname.startsWith("/admin") || pathname === "/setup"
      ? adminLinks
      : [];

  return (
    <header className="border-b border-white/10 bg-[rgba(15,23,20,0.86)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
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
          {authStatus.isAuthenticated && nowPlaying ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-3 rounded-2xl border border-[--color-accent]/35 bg-[--color-accent]/10 px-3 py-2 text-left">
              {nowPlaying.artworkUrl ? (
                <img
                  src={nowPlaying.artworkUrl}
                  alt=""
                  className="h-11 w-11 rounded-xl object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[--color-accent]">
                  {nowPlaying.isPlaying ? "Now playing" : "Last played"}
                </p>
                <p className="truncate text-sm font-semibold text-stone-100">{nowPlaying.title}</p>
                <p className="truncate text-xs text-stone-300">{nowPlaying.artists.join(", ") || "Spotify"}</p>
              </div>
              {nowPlaying.spotifyUrl ? (
                <a
                  href={nowPlaying.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-xs text-stone-200 transition hover:border-[--color-accent] hover:text-white"
                >
                  Open
                </a>
              ) : null}
            </div>
          ) : null}
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
    </header>
  );
}
