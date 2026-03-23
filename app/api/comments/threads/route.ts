import { NextRequest, NextResponse } from "next/server";

import { getCommentThreads } from "@/lib/services/comment-service";

export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get("trackId")?.trim();
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  const result = await getCommentThreads(trackId);

  return NextResponse.json(
    {
      featureAvailable: result.featureAvailable,
      trackId,
      version: result.version,
      threads: result.data,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
