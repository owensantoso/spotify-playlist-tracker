import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

import { signValue, verifySignedValue } from "@/lib/security";

const AUTH_STATE_COOKIE = "fotm_spotify_oauth_state";

export async function createOAuthState() {
  const value = randomUUID();
  const signature = signValue(value);
  const store = await cookies();

  store.set(AUTH_STATE_COOKIE, `${value}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });

  return value;
}

export async function consumeOAuthState(expectedState: string) {
  const store = await cookies();
  const raw = store.get(AUTH_STATE_COOKIE)?.value;
  store.delete(AUTH_STATE_COOKIE);

  if (!raw) {
    return false;
  }

  const [value, signature] = raw.split(".");
  if (!value || !signature) {
    return false;
  }

  return value === expectedState && verifySignedValue(value, signature);
}
