import { NextRequest, NextResponse } from "next/server";
import { SongReactionKind } from "@prisma/client";

import {
  ReactionFeatureUnavailableError,
  ReactionUnauthorizedError,
  setTrackReaction,
} from "@/lib/services/reaction-service";

function isReactionKind(value: string): value is SongReactionKind {
  return value === "LIKE" || value === "SUPERLIKE";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    trackSpotifyId?: string;
    kind?: string;
  } | null;

  if (!body?.trackSpotifyId || !body.kind || !isReactionKind(body.kind)) {
    return NextResponse.json({ error: "Invalid reaction request." }, { status: 400 });
  }

  try {
    const result = await setTrackReaction({
      trackSpotifyId: body.trackSpotifyId,
      kind: body.kind,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ReactionUnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof ReactionFeatureUnavailableError) {
      return NextResponse.json({ error: error.message, code: "FEATURE_UNAVAILABLE" }, { status: 503 });
    }

    return NextResponse.json({ error: "Could not save your reaction." }, { status: 500 });
  }
}
