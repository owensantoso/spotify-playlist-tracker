import { NextResponse } from "next/server";

import { createOAuthState } from "@/lib/auth-state";
import { buildSpotifyAuthorizeUrl } from "@/lib/spotify/client";

export async function GET() {
  const state = await createOAuthState();
  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state));
}
