/* eslint-disable @next/next/no-img-element */

"use client";

import { LoaderCircle, MessageCirclePlus, MessagesSquare, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { NowPlayingTrack } from "@/lib/services/now-playing-service";
import { cn } from "@/lib/utils";

type AuthStatus = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  spotifyUserId: string | null;
};

type MarkerAuthor = {
  spotifyUserId: string;
  displayName: string | null;
  imageUrl: string | null;
  profileUrl: string | null;
};

type CommentMarker = {
  markerBucketSecond: number;
  timestampMsRepresentative: number;
  commentCount: number;
  threadCount: number;
  authors: MarkerAuthor[];
  previewComment: string;
  topLevelCommentIds: string[];
};

type CommentThread = {
  id: string;
  trackSpotifyId: string;
  threadRootId: string;
  parentCommentId: string | null;
  timestampMs: number;
  markerBucketSecond: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: MarkerAuthor;
  replies: CommentThread[];
};

type MarkerResponse = {
  featureAvailable: boolean;
  trackId: string;
  version: string;
  markers: CommentMarker[];
};

type ThreadsResponse = {
  featureAvailable: boolean;
  trackId: string;
  version: string;
  threads: CommentThread[];
};

type CommentMutationResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
};

type NowPlayingCommentsProps = {
  track: NowPlayingTrack | null;
  progressMs: number;
  authStatus: AuthStatus;
  controlStatusLabel: string;
  onRefreshNowPlaying: () => Promise<NowPlayingTrack | null>;
};

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getInitials(name: string | null | undefined) {
  const label = (name ?? "?").trim();
  const words = label.split(/\s+/).filter(Boolean);

  return (words.length ? words : [label])
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({
  author,
  sizeClassName = "h-6 w-6",
}: {
  author: MarkerAuthor;
  sizeClassName?: string;
}) {
  if (author.imageUrl) {
    return (
      <img
        src={author.imageUrl}
        alt=""
        className={`${sizeClassName} rounded-full object-cover ring-1 ring-white/12`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClassName} inline-flex items-center justify-center rounded-full bg-white/8 font-mono text-[9px] uppercase tracking-[0.08em] text-stone-300 ring-1 ring-white/10`}
    >
      {getInitials(author.displayName ?? author.spotifyUserId)}
    </span>
  );
}

function CommentNode({ comment, depth = 0 }: { comment: CommentThread; depth?: number }) {
  return (
    <div className={cn("rounded-2xl border border-white/8 bg-black/10 p-3", depth > 0 && "mt-2 ml-4")}>
      <div className="flex items-start gap-3">
        <Avatar author={comment.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-400">
            <span className="font-medium text-stone-200">
              {comment.author.displayName ?? comment.author.spotifyUserId}
            </span>
            <span>{formatMs(comment.timestampMs)}</span>
            <span>{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-100">{comment.body}</p>
        </div>
      </div>
      {comment.replies.length ? (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NowPlayingComments({
  track,
  progressMs,
  authStatus,
  controlStatusLabel,
  onRefreshNowPlaying,
}: NowPlayingCommentsProps) {
  const pathname = usePathname();
  const [markers, setMarkers] = useState<CommentMarker[]>([]);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [markersFeatureAvailable, setMarkersFeatureAvailable] = useState(true);
  const [threadsFeatureAvailable, setThreadsFeatureAvailable] = useState(true);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openMarkerBucket, setOpenMarkerBucket] = useState<number | null>(null);
  const [popupBucket, setPopupBucket] = useState<number | null>(null);
  const [playbackSessionKey, setPlaybackSessionKey] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const shownPopupKeysRef = useRef<Set<string>>(new Set());

  const trackId = track?.spotifyTrackId ?? null;

  async function loadMarkers(nextTrackId: string) {
    setMarkersLoading(true);

    try {
      const response = await fetch(`/api/comments/markers?trackId=${encodeURIComponent(nextTrackId)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as MarkerResponse;
      setMarkersFeatureAvailable(payload.featureAvailable);
      setMarkers(payload.markers);
    } catch {
      // Preserve previous markers during transient errors.
    } finally {
      setMarkersLoading(false);
    }
  }

  async function loadThreads(nextTrackId: string) {
    setThreadsLoading(true);

    try {
      const response = await fetch(`/api/comments/threads?trackId=${encodeURIComponent(nextTrackId)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ThreadsResponse;
      setThreadsFeatureAvailable(payload.featureAvailable);
      setThreads(payload.threads);
    } catch {
      // Preserve previous threads during transient errors.
    } finally {
      setThreadsLoading(false);
    }
  }

  useEffect(() => {
    setOpenMarkerBucket(null);
    setPopupBucket(null);
    setComposerOpen(false);
    setSubmitError(null);
    shownPopupKeysRef.current.clear();
    setPlaybackSessionKey((current) => current + 1);

    if (!trackId) {
      setMarkers([]);
      setThreads([]);
      return;
    }

    void loadMarkers(trackId);
    if (showAllComments) {
      void loadThreads(trackId);
    }
  }, [showAllComments, trackId]);

  useEffect(() => {
    if (trackId && showAllComments) {
      void loadThreads(trackId);
    }
  }, [showAllComments, trackId]);

  useEffect(() => {
    if (progressMs + 1_500 < progressRef.current) {
      shownPopupKeysRef.current.clear();
      setPlaybackSessionKey((current) => current + 1);
    }
    progressRef.current = progressMs;
  }, [progressMs]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (previewContainerRef.current && !previewContainerRef.current.contains(event.target as Node)) {
        setOpenMarkerBucket(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!track || !markers.length) {
      setPopupBucket(null);
      return;
    }

    const currentBucket = markers.find((marker) => {
      const popupKey = `${track.spotifyTrackId}:${marker.markerBucketSecond}:${playbackSessionKey}`;
      if (shownPopupKeysRef.current.has(popupKey)) {
        return false;
      }

      const delta = marker.timestampMsRepresentative - progressMs;
      return delta >= 0 && delta <= 3_000;
    });

    if (currentBucket) {
      shownPopupKeysRef.current.add(
        `${track.spotifyTrackId}:${currentBucket.markerBucketSecond}:${playbackSessionKey}`,
      );
      setPopupBucket(currentBucket.markerBucketSecond);
      return;
    }

    if (popupBucket != null) {
      const activePopup = markers.find((marker) => marker.markerBucketSecond === popupBucket);
      if (!activePopup || progressMs > activePopup.timestampMsRepresentative + 2_000) {
        setPopupBucket(null);
      }
    }
  }, [markers, playbackSessionKey, popupBucket, progressMs, track]);

  const progressPercent = useMemo(() => {
    if (!track?.durationMs || track.durationMs <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (progressMs / track.durationMs) * 100));
  }, [progressMs, track?.durationMs]);

  const popupMarker = markers.find((marker) => marker.markerBucketSecond === popupBucket) ?? null;
  const trackDurationMs = track?.durationMs ?? 0;

  async function handleCommentMutationError(data: CommentMutationResponse | null) {
    if (data?.code === "TRACK_CHANGED") {
      await onRefreshNowPlaying();
      setSubmitError("Playback changed. Re-capture the current song and try again.");
      return;
    }

    if (data?.code === "NO_ACTIVE_PLAYBACK") {
      await onRefreshNowPlaying();
      setSubmitError("Spotify could not confirm an active track. Try again once playback is active.");
      return;
    }

    if (data?.code === "FEATURE_UNAVAILABLE") {
      setSubmitError("Comments are unavailable until the latest database migration is applied.");
      return;
    }

    if (data?.error) {
      setSubmitError(data.error);
      return;
    }

    setSubmitError("Could not save your comment.");
  }

  async function handleSubmitComment() {
    if (!track) {
      setSubmitError("Start playback on Spotify before commenting.");
      return;
    }

    setSubmitPending(true);
    setSubmitError(null);

    const payload = {
      expectedTrackId: track.spotifyTrackId,
      expectedProgressMs: progressMs,
      capturedAt: Date.now(),
      body: commentDraft,
      clientSubmissionId: crypto.randomUUID(),
    };

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as CommentMutationResponse | null;

      if (!response.ok) {
        if (data?.code === "PROGRESS_DRIFT") {
          const refreshedTrack = await onRefreshNowPlaying();
          if (!refreshedTrack || refreshedTrack.spotifyTrackId !== payload.expectedTrackId) {
            setSubmitError("Playback changed. Re-capture the current song and try again.");
            return;
          }
          const retryResponse = await fetch("/api/comments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({
              ...payload,
              expectedProgressMs: refreshedTrack.progressMs,
              capturedAt: Date.now(),
              clientSubmissionId: payload.clientSubmissionId,
            }),
          });

          if (retryResponse.ok) {
            setCommentDraft("");
            setComposerOpen(false);
            if (trackId) {
              await loadMarkers(trackId);
              if (showAllComments) {
                await loadThreads(trackId);
              }
            }
            return;
          }

          const retryData = (await retryResponse.json().catch(() => null)) as CommentMutationResponse | null;
          await handleCommentMutationError(retryData);
          return;
        }

        await handleCommentMutationError(data);
        return;
      }

      setCommentDraft("");
      setComposerOpen(false);
      if (trackId) {
        await loadMarkers(trackId);
        if (showAllComments) {
          await loadThreads(trackId);
        }
      }
    } catch {
      setSubmitError("Could not save your comment.");
    } finally {
      setSubmitPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-3" ref={previewContainerRef}>
      <div className="relative pt-5">
        {popupMarker && track ? (
          <div className="absolute left-0 top-0 z-20 max-w-sm rounded-2xl border border-[--color-accent]/35 bg-[rgba(23,31,26,0.97)] px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--color-accent]">
              Upcoming comment at {formatMs(popupMarker.timestampMsRepresentative)}
            </p>
            <p className="mt-1 text-sm text-stone-100">{popupMarker.previewComment}</p>
          </div>
        ) : null}

        <div className="relative h-2 overflow-visible rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(243,167,92,0.92),rgba(106,161,109,0.95))] transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />

          {trackDurationMs > 0
            ? markers.map((marker) => {
                const left = Math.max(
                  0,
                  Math.min(100, (marker.timestampMsRepresentative / trackDurationMs) * 100),
                );
                const isOpen = marker.markerBucketSecond === openMarkerBucket;
                const labelBase =
                  marker.authors[0]?.displayName ?? marker.authors[0]?.spotifyUserId ?? "Unknown";

                return (
                  <button
                    key={marker.markerBucketSecond}
                    type="button"
                    className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
                    style={{ left: `${left}%` }}
                    onMouseEnter={() => setOpenMarkerBucket(marker.markerBucketSecond)}
                    onMouseLeave={() =>
                      setOpenMarkerBucket((current) =>
                        current === marker.markerBucketSecond ? null : current,
                      )
                    }
                    onFocus={() => setOpenMarkerBucket(marker.markerBucketSecond)}
                    onClick={() =>
                      setOpenMarkerBucket((current) =>
                        current === marker.markerBucketSecond ? null : marker.markerBucketSecond,
                      )
                    }
                    aria-label={`Comment at ${formatMs(marker.timestampMsRepresentative)} by ${labelBase}`}
                  >
                    <span className="relative inline-flex items-center justify-center">
                      <span className="absolute top-[16px] h-3 w-[2px] rounded-full bg-[--color-accent]/70" />
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[--color-accent]/45 bg-[rgba(18,26,21,0.96)] px-1.5 shadow-[0_6px_14px_rgba(0,0,0,0.28)]">
                        <span className="flex -space-x-1">
                          {marker.authors.slice(0, 3).map((author) => (
                            <Avatar
                              key={`${marker.markerBucketSecond}-${author.spotifyUserId}`}
                              author={author}
                              sizeClassName="h-4 w-4"
                            />
                          ))}
                        </span>
                        {marker.threadCount > 3 ? (
                          <span className="ml-1 font-mono text-[9px] text-stone-300">
                            +{marker.threadCount - 3}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {isOpen ? (
                      <span className="absolute left-1/2 top-[34px] z-20 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[rgba(14,22,18,0.98)] p-3 text-left shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--color-accent]">
                          {formatMs(marker.timestampMsRepresentative)}
                        </span>
                        <span className="mt-1 block text-sm text-stone-100">{marker.previewComment}</span>
                        <span className="mt-2 block text-[11px] text-stone-400">
                          {marker.threadCount} comment thread{marker.threadCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })
            : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-stone-400">
          <span>{formatMs(progressMs)}</span>
          <span>{controlStatusLabel}</span>
          <span>{formatMs(track?.durationMs ?? 0)}</span>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-white/10 bg-black/10 p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone-400">
              Song comments
            </p>
            <p className="text-sm text-stone-300">
              {track
                ? "Attach comments to the exact moment this song is playing."
                : "Start playback on Spotify to comment on the current track."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {authStatus.isViewer ? (
              <button
                type="button"
                onClick={() => {
                  setComposerOpen((current) => !current);
                  setSubmitError(null);
                }}
                disabled={!track}
                className="inline-flex items-center gap-2 rounded-full border border-[--color-accent]/45 bg-[--color-accent]/10 px-4 py-2 text-sm text-[--color-accent] transition hover:bg-[--color-accent]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCirclePlus className="h-4 w-4" />
                Comment
              </button>
            ) : (
              <a
                href={`/api/auth/spotify/login?mode=viewer&next=${encodeURIComponent(pathname || "/")}`}
                className="rounded-full border border-[--color-accent]/45 bg-[--color-accent]/10 px-4 py-2 text-sm text-[--color-accent] transition hover:bg-[--color-accent]/20"
              >
                Sign in to comment
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowAllComments((current) => !current)}
              disabled={!track}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-stone-200 transition hover:border-[--color-accent] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessagesSquare className="h-4 w-4" />
              {showAllComments ? "Hide comments" : "Show all comments"}
            </button>
          </div>
        </div>

        {composerOpen ? (
          <div className="mt-3 rounded-3xl border border-white/10 bg-black/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--color-accent]">
                  Commenting at {formatMs(progressMs)}
                </p>
                <p className="mt-1 text-sm text-stone-300">
                  {track?.title ?? "Playback must be active to comment."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-full border border-white/10 p-2 text-stone-400 transition hover:border-white/20 hover:text-stone-200"
                aria-label="Close comment composer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              rows={4}
              placeholder="Write what hits at this exact moment..."
              className="mt-3 w-full rounded-2xl border border-white/10 bg-[rgba(10,15,12,0.88)] px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-[--color-accent]"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-stone-500">
                The final timestamp is verified from a fresh Spotify playback read when you submit.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    setSubmitError(null);
                  }}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-stone-300 transition hover:border-white/20 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitComment()}
                  disabled={submitPending || !track || !commentDraft.trim()}
                  className="inline-flex items-center gap-2 rounded-full border border-[--color-accent]/45 bg-[--color-accent]/10 px-4 py-2 text-sm text-[--color-accent] transition hover:bg-[--color-accent]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCirclePlus className="h-4 w-4" />}
                  {submitPending ? "Saving comment..." : "Save comment"}
                </button>
              </div>
            </div>

            {submitError ? <p className="mt-3 text-sm text-rose-300">{submitError}</p> : null}
          </div>
        ) : null}

        {!markersFeatureAvailable || !threadsFeatureAvailable ? (
          <p className="mt-3 text-sm text-amber-200">
            Comments are unavailable until the latest database migration is applied.
          </p>
        ) : null}

        {showAllComments ? (
          <div className="mt-3 rounded-3xl border border-white/10 bg-black/15 p-3">
            {!track ? (
              <p className="text-sm text-stone-400">No active track is available for comments right now.</p>
            ) : threadsLoading ? (
              <div className="flex items-center gap-2 text-sm text-stone-400">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading comments...
              </div>
            ) : threads.length ? (
              <div className="space-y-3">
                {threads.map((thread) => (
                  <CommentNode key={thread.id} comment={thread} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">
                No comments yet for this track. Be the first one to pin a moment.
              </p>
            )}
          </div>
        ) : markersLoading && track ? (
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading comment markers...
          </div>
        ) : null}
      </div>
    </div>
  );
}
