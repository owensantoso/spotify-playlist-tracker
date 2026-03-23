import { NextRequest, NextResponse } from "next/server";

import {
  CommentFeatureUnavailableError,
  CommentNotFoundError,
  CommentUnauthorizedError,
  CommentValidationError,
  deleteComment,
  isCommentFeatureUnavailable,
  updateComment,
} from "@/lib/services/comment-service";

type RouteContext = {
  params: Promise<{
    commentId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { commentId } = await context.params;
  const body = (await request.json().catch(() => null)) as { body?: string } | null;

  if (!commentId || typeof body?.body !== "string") {
    return NextResponse.json({ error: "Invalid edit payload" }, { status: 400 });
  }

  try {
    const result = await updateComment({
      commentId,
      body: body.body,
    });

    return NextResponse.json(
      { ok: true, comment: result.comment },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof CommentUnauthorizedError) {
      return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: 401 });
    }

    if (error instanceof CommentNotFoundError) {
      return NextResponse.json({ error: error.message, code: "NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof CommentValidationError) {
      return NextResponse.json({ error: error.message, code: "INVALID_COMMENT" }, { status: 400 });
    }

    if (error instanceof CommentFeatureUnavailableError || isCommentFeatureUnavailable(error)) {
      return NextResponse.json(
        { error: "Comments are unavailable until the database migration is applied.", code: "FEATURE_UNAVAILABLE" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to update comment." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { commentId } = await context.params;

  if (!commentId) {
    return NextResponse.json({ error: "Invalid delete payload" }, { status: 400 });
  }

  try {
    const result = await deleteComment({ commentId });

    return NextResponse.json(
      { ok: true, comment: result.comment },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof CommentUnauthorizedError) {
      return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: 401 });
    }

    if (error instanceof CommentNotFoundError) {
      return NextResponse.json({ error: error.message, code: "NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof CommentFeatureUnavailableError || isCommentFeatureUnavailable(error)) {
      return NextResponse.json(
        { error: "Comments are unavailable until the database migration is applied.", code: "FEATURE_UNAVAILABLE" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Failed to delete comment." }, { status: 500 });
  }
}
