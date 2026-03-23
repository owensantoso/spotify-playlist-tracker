import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

import { signValue, verifySignedValue } from "@/lib/security";

const AUTH_STATE_COOKIE = "fotm_spotify_oauth_state";

export type OAuthIntent = "admin" | "viewer";

type OAuthStatePayload = {
  state: string;
  intent: OAuthIntent;
  redirectTo: string;
};

function encodePayload(payload: OAuthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as OAuthStatePayload;
}

export async function createOAuthState({
  intent,
  redirectTo,
}: {
  intent: OAuthIntent;
  redirectTo: string;
}) {
  const payload = encodePayload({
    state: randomUUID(),
    intent,
    redirectTo,
  });
  const signature = signValue(payload);
  const store = await cookies();

  store.set(AUTH_STATE_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });

  return decodePayload(payload).state;
}

export async function consumeOAuthState(expectedState: string) {
  const store = await cookies();
  const raw = store.get(AUTH_STATE_COOKIE)?.value;
  store.delete(AUTH_STATE_COOKIE);

  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !verifySignedValue(payload, signature)) {
    return null;
  }

  try {
    const decoded = decodePayload(payload);
    return decoded.state === expectedState ? decoded : null;
  } catch {
    return null;
  }
}
