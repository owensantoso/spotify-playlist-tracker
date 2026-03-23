import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { consumeOAuthState } from "@/lib/auth-state";
import { exchangeCodeForTokens, getCurrentUser } from "@/lib/spotify/client";
import { upsertAdminAccount } from "@/lib/services/admin-service";
import { setAdminSessionOnResponse } from "@/lib/session";
import { absoluteUrl } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(absoluteUrl("/setup?error=missing_oauth_params"));
  }

  const isValidState = await consumeOAuthState(state);
  if (!isValidState) {
    return NextResponse.redirect(absoluteUrl("/setup?error=invalid_oauth_state"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getCurrentUser(tokens.access_token);

    await upsertAdminAccount({
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresInSeconds: tokens.expires_in,
      scope: tokens.scope,
    });
    const response = NextResponse.redirect(absoluteUrl("/setup?connected=1"));
    setAdminSessionOnResponse(response, profile.id);
    revalidatePath("/setup");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/logs");

    return response;
  } catch (error) {
    return NextResponse.redirect(absoluteUrl(`/setup?error=${encodeURIComponent(String(error))}`));
  }
}
