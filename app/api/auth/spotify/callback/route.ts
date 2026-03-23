import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { consumeOAuthState } from "@/lib/auth-state";
import { exchangeCodeForTokens, getCurrentUser, SpotifyApiError } from "@/lib/spotify/client";
import { upsertAdminAccount } from "@/lib/services/admin-service";
import { upsertSpotifyUserProfile } from "@/lib/services/user-account-service";
import { setAdminSessionOnResponse, setViewerSessionOnResponse } from "@/lib/session";
import { absoluteUrl } from "@/lib/utils";

function buildErrorRedirectPath(redirectTo: string, error: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}error=${encodeURIComponent(error)}`;
}

function formatSpotifyErrorBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const spotifyError =
    "error" in body && body.error && typeof body.error === "object" ? body.error : body;
  const status =
    "status" in spotifyError && typeof spotifyError.status === "number"
      ? spotifyError.status
      : null;
  const message =
    "message" in spotifyError && typeof spotifyError.message === "string"
      ? spotifyError.message
      : null;
  const error =
    "error" in spotifyError && typeof spotifyError.error === "string" ? spotifyError.error : null;

  return [status, error, message].filter(Boolean).join(" ");
}

function describeCallbackError(error: unknown) {
  if (error instanceof SpotifyApiError) {
    const detail = formatSpotifyErrorBody(error.body);
    return detail
      ? `${error.message} (status ${error.status}: ${detail})`
      : `${error.message} (status ${error.status})`;
  }

  return String(error);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(absoluteUrl("/setup?error=missing_oauth_params"));
  }

  const oauthState = await consumeOAuthState(state);
  if (!oauthState) {
    return NextResponse.redirect(absoluteUrl("/setup?error=invalid_oauth_state"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getCurrentUser(tokens.access_token);

    const accountParams = {
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresInSeconds: tokens.expires_in,
      scope: tokens.scope,
    };

    if (oauthState.intent === "admin") {
      await upsertAdminAccount(accountParams);
    } else {
      await upsertSpotifyUserProfile(profile);
    }

    const redirectTarget =
      oauthState.intent === "admin"
        ? `${oauthState.redirectTo}${oauthState.redirectTo.includes("?") ? "&" : "?"}connected=1`
        : oauthState.redirectTo;
    const response = NextResponse.redirect(absoluteUrl(redirectTarget));
    setViewerSessionOnResponse(response, {
      spotifyUserId: profile.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    if (oauthState.intent === "admin") {
      setAdminSessionOnResponse(response, profile.id);
      revalidatePath("/setup");
      revalidatePath("/admin/settings");
      revalidatePath("/admin/logs");
    }

    revalidatePath("/");
    revalidatePath("/active");
    revalidatePath("/history");
    revalidatePath("/contributors");

    return response;
  } catch (error) {
    console.error("Spotify auth callback failed", error);

    return NextResponse.redirect(
      absoluteUrl(buildErrorRedirectPath(oauthState.redirectTo, describeCallbackError(error))),
    );
  }
}
