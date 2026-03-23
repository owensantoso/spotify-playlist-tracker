import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { signValue, verifySignedValue } from "@/lib/security";

export const ADMIN_SESSION_COOKIE_NAME = "fotm_admin_session";
export const VIEWER_SESSION_COOKIE_NAME = "fotm_viewer_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SpotifySessionPayload = {
  spotifyUserId: string;
  issuedAt: string;
};

function encodePayload(payload: SpotifySessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SpotifySessionPayload;
}

function buildSessionCookieValue(spotifyUserId: string) {
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

async function setSessionCookie(cookieName: string, spotifyUserId: string) {
  const store = await cookies();
  store.set(cookieName, buildSessionCookieValue(spotifyUserId), getSessionCookieOptions());
}

function setSessionCookieOnResponse(response: NextResponse, cookieName: string, spotifyUserId: string) {
  response.cookies.set(
    cookieName,
    buildSessionCookieValue(spotifyUserId),
    getSessionCookieOptions(),
  );
}

async function clearSessionCookie(cookieName: string) {
  const store = await cookies();
  store.delete(cookieName);
}

async function getSession(cookieName: string) {
  const store = await cookies();
  const raw = store.get(cookieName)?.value;
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

export async function setAdminSession(spotifyUserId: string) {
  await setSessionCookie(ADMIN_SESSION_COOKIE_NAME, spotifyUserId);
}

export function setAdminSessionOnResponse(response: NextResponse, spotifyUserId: string) {
  setSessionCookieOnResponse(response, ADMIN_SESSION_COOKIE_NAME, spotifyUserId);
}

export async function clearAdminSession() {
  await clearSessionCookie(ADMIN_SESSION_COOKIE_NAME);
}

export async function getAdminSession() {
  return getSession(ADMIN_SESSION_COOKIE_NAME);
}

export async function setViewerSession(spotifyUserId: string) {
  await setSessionCookie(VIEWER_SESSION_COOKIE_NAME, spotifyUserId);
}

export function setViewerSessionOnResponse(response: NextResponse, spotifyUserId: string) {
  setSessionCookieOnResponse(response, VIEWER_SESSION_COOKIE_NAME, spotifyUserId);
}

export async function clearViewerSession() {
  await clearSessionCookie(VIEWER_SESSION_COOKIE_NAME);
}

export async function getViewerSession() {
  return getSession(VIEWER_SESSION_COOKIE_NAME);
}
