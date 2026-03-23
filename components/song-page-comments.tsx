"use client";

import { useCallback, useEffect, useState } from "react";

import { NowPlayingComments } from "@/components/now-playing-comments";
import type { CommentTrackPayload } from "@/lib/services/comment-service";
import type { NowPlayingTrack } from "@/lib/services/now-playing-service";

type AuthStatus = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  spotifyUserId: string | null;
};

type NowPlayingResponse = {
  nowPlaying: NowPlayingTrack | null;
};

const POLL_MS = 5000;
const PROGRESS_TICK_MS = 250;

type SongPageCommentsProps = {
  track: NowPlayingTrack;
  commentPayload: CommentTrackPayload;
  initialMatchesPlayback: boolean;
  initialProgressMs: number;
  initialIsPlaying: boolean;
  initialDeviceName: string | null;
};

export function SongPageComments({
  track,
  commentPayload,
  initialMatchesPlayback,
  initialProgressMs,
  initialIsPlaying,
  initialDeviceName,
}: SongPageCommentsProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    isAdmin: false,
    isViewer: false,
    spotifyUserId: null,
  });
  const [authStatusResolved, setAuthStatusResolved] = useState(false);
  const [matchesPlayback, setMatchesPlayback] = useState(initialMatchesPlayback);
  const [progressMs, setProgressMs] = useState(initialMatchesPlayback ? initialProgressMs : 0);
  const [isPlaying, setIsPlaying] = useState(initialMatchesPlayback ? initialIsPlaying : false);
  const [deviceName, setDeviceName] = useState(initialMatchesPlayback ? initialDeviceName : null);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const response = await fetch("/api/auth/status", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (!cancelled) {
            setAuthStatusResolved(true);
          }
          return;
        }

        const nextStatus = (await response.json()) as AuthStatus;
        if (!cancelled) {
          setAuthStatus(nextStatus);
          setAuthStatusResolved(true);
        }
      } catch {
        if (!cancelled) {
          setAuthStatusResolved(true);
        }
      }
    }

    void loadAuthStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNowPlaying = useCallback(async () => {
    try {
      const response = await fetch("/api/spotify/now-playing", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setMatchesPlayback(false);
        setProgressMs(0);
        setIsPlaying(false);
        setDeviceName(null);
        return null;
      }

      const payload = (await response.json()) as NowPlayingResponse;
      const currentTrack = payload.nowPlaying;

      if (!currentTrack || currentTrack.spotifyTrackId !== track.spotifyTrackId) {
        setMatchesPlayback(false);
        setProgressMs(0);
        setIsPlaying(false);
        setDeviceName(null);
        return currentTrack;
      }

      setMatchesPlayback(true);
      setProgressMs(currentTrack.progressMs);
      setIsPlaying(currentTrack.isPlaying);
      setDeviceName(currentTrack.deviceName);
      return currentTrack;
    } catch {
      return null;
    }
  }, [track.spotifyTrackId]);

  useEffect(() => {
    if (!authStatusResolved || !authStatus.isAuthenticated) {
      return;
    }

    window.setTimeout(() => {
      void loadNowPlaying();
    }, 0);
    const interval = window.setInterval(() => {
      void loadNowPlaying();
    }, POLL_MS);

    return () => window.clearInterval(interval);
  }, [authStatus.isAuthenticated, authStatusResolved, loadNowPlaying]);

  useEffect(() => {
    if (!matchesPlayback || !isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgressMs((current) => {
        const duration = track.durationMs ?? current + PROGRESS_TICK_MS;
        return Math.min(current + PROGRESS_TICK_MS, duration);
      });
    }, PROGRESS_TICK_MS);

    return () => window.clearInterval(interval);
  }, [isPlaying, matchesPlayback, track.durationMs]);

  useEffect(() => {
    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent<{ delayMs?: number }>).detail;
      const delayMs = Math.max(0, detail?.delayMs ?? 0);
      window.setTimeout(() => {
        void loadNowPlaying();
      }, delayMs);
    }

    window.addEventListener("fotm:refresh-now-playing", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("fotm:refresh-now-playing", handleRefresh as EventListener);
    };
  }, [loadNowPlaying]);

  const displayTrack: NowPlayingTrack = {
    ...track,
    progressMs: matchesPlayback ? progressMs : 0,
    isPlaying: matchesPlayback ? isPlaying : false,
    deviceName: matchesPlayback ? deviceName : null,
  };

  return (
    <NowPlayingComments
      track={displayTrack}
      progressMs={matchesPlayback ? progressMs : 0}
      authStatus={authStatus}
      controlStatusLabel=""
      onRefreshNowPlaying={loadNowPlaying}
      commentPayload={commentPayload}
      interactionEnabled={matchesPlayback}
    />
  );
}
