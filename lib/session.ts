import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { signValue, verifySignedValue } from "@/lib/security";

export const SESSION_COOKIE_NAME = "fotm_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AdminSessionPayload = {
  spotifyUserId: string;
  issuedAt: string;
};

function encodePayload(payload: AdminSessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AdminSessionPayload;
}

function buildAdminSessionCookieValue(spotifyUserId: string) {
  const payload = encodePayload({
    spotifyUserId,
    issuedAt: new Date().toISOString(),
  });
  const signature = signValue(payload);

  return `${payload}.${signature}`;
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function setAdminSession(spotifyUserId: string) {
  const store = await cookies();

  store.set(SESSION_COOKIE_NAME, buildAdminSessionCookieValue(spotifyUserId), getSessionCookieOptions());
}

export function setAdminSessionOnResponse(response: NextResponse, spotifyUserId: string) {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    buildAdminSessionCookieValue(spotifyUserId),
    getSessionCookieOptions(),
  );
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getAdminSession() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !verifySignedValue(payload, signature)) {
    return null;
  }

  try {
    return decodePayload(payload);
  } catch {
    return null;
  }
}
