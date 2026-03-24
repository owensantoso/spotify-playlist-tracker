import { NextRequest, NextResponse } from "next/server";

import { setViewerSessionOnResponse } from "@/lib/session";
import {
  CommentFeatureUnavailableError,
  CommentUnauthorizedError,
  CommentValidationError,
  createReplyComment,
  isCommentFeatureUnavailable,
} from "@/lib/services/comment-service";

type CreateReplyRequest = {
  body?: string;
  clientSubmissionId?: string;
  imageDataUrl?: string | null;
  audioDataUrl?: string | null;
  audioDurationMs?: number | null;
};

type RouteContext = {
  params: Promise<{
    commentId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { commentId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateReplyRequest | null;

  if (!commentId || typeof body?.body !== "string" || !body.clientSubmissionId) {
    return NextResponse.json({ error: "Invalid reply payload" }, { status: 400 });
  }

  try {
    const result = await createReplyComment({
      parentCommentId: commentId,
      body: body.body,
      clientSubmissionId: body.clientSubmissionId,
      imageDataUrl: body.imageDataUrl ?? null,
      audioDataUrl: body.audioDataUrl ?? null,
      audioDurationMs: body.audioDurationMs ?? null,
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
      return NextResponse.json({ error: error.message, code: "INVALID_REPLY" }, { status: 400 });
    }

    if (error instanceof CommentFeatureUnavailableError || isCommentFeatureUnavailable(error)) {
      return NextResponse.json(
        { error: "Comments are unavailable until the database migration is applied.", code: "FEATURE_UNAVAILABLE" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to create reply." }, { status: 500 });
  }
}
