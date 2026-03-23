import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { consumeOAuthState } from "@/lib/auth-state";
import { exchangeCodeForTokens, getCurrentUser } from "@/lib/spotify/client";
import { upsertAdminAccount } from "@/lib/services/admin-service";
import { upsertUserAccount } from "@/lib/services/user-account-service";
import { setAdminSessionOnResponse, setViewerSessionOnResponse } from "@/lib/session";
import { absoluteUrl } from "@/lib/utils";

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
      await upsertUserAccount(accountParams);
    }

    const redirectTarget =
      oauthState.intent === "admin"
        ? `${oauthState.redirectTo}${oauthState.redirectTo.includes("?") ? "&" : "?"}connected=1`
        : oauthState.redirectTo;
    const response = NextResponse.redirect(absoluteUrl(redirectTarget));
    setViewerSessionOnResponse(response, profile.id);

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
    return NextResponse.redirect(absoluteUrl(`/setup?error=${encodeURIComponent(String(error))}`));
  }
}
