import { NextRequest, NextResponse } from "next/server";

import { setViewerSessionOnResponse } from "@/lib/session";
import {
  CommentFeatureUnavailableError,
  CommentPlaybackMismatchError,
  CommentUnauthorizedError,
  CommentValidationError,
  createTopLevelComment,
  getCommentTrackPayload,
  isCommentFeatureUnavailable,
} from "@/lib/services/comment-service";

type CreateCommentRequest = {
  expectedTrackId?: string;
  expectedProgressMs?: number;
  capturedAt?: number;
  body?: string;
  clientSubmissionId?: string;
};

export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get("trackId")?.trim();
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  const payload = await getCommentTrackPayload(trackId);

  return NextResponse.json(
    {
      featureAvailable: payload.featureAvailable,
      trackId,
      version: payload.version,
      markers: payload.markers,
      threads: payload.threads,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CreateCommentRequest | null;

  if (!body?.expectedTrackId || !body.clientSubmissionId || typeof body.body !== "string") {
    return NextResponse.json({ error: "Invalid comment payload" }, { status: 400 });
  }

  try {
    const result = await createTopLevelComment({
      expectedTrackId: body.expectedTrackId,
      expectedProgressMs: Number(body.expectedProgressMs ?? 0),
      capturedAt: Number(body.capturedAt ?? Date.now()),
      body: body.body,
      clientSubmissionId: body.clientSubmissionId,
    });

    const response = NextResponse.json(
      { ok: true, comment: result.comment },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );

    if (result.refreshedViewerSession) {
      setViewerSessionOnResponse(response, result.refreshedViewerSession);
    }

    return response;
  } catch (error) {
    if (error instanceof CommentUnauthorizedError) {
      return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: 401 });
    }

    if (error instanceof CommentValidationError) {
      return NextResponse.json({ error: error.message, code: "INVALID_COMMENT" }, { status: 400 });
    }

    if (error instanceof CommentPlaybackMismatchError) {
      const status =
        error.code === "TRACK_CHANGED"
          ? 409
          : error.code === "PROGRESS_DRIFT"
            ? 412
            : 428;

      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status },
      );
    }

    if (error instanceof CommentFeatureUnavailableError || isCommentFeatureUnavailable(error)) {
      return NextResponse.json(
        { error: "Comments are unavailable until the database migration is applied.", code: "FEATURE_UNAVAILABLE" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to create comment." }, { status: 500 });
  }
}
