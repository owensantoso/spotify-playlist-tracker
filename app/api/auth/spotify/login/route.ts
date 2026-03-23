import { NextResponse } from "next/server";

import { type OAuthIntent, createOAuthState } from "@/lib/auth-state";
import { buildSpotifyAuthorizeUrl } from "@/lib/spotify/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const next = searchParams.get("next");
  const intent: OAuthIntent = mode === "admin" ? "admin" : "viewer";
  const redirectTo = next?.startsWith("/") ? next : intent === "admin" ? "/setup" : "/";
  const state = await createOAuthState({ intent, redirectTo });
  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state));
}
