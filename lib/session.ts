import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { decryptValue, encryptValue, signValue, verifySignedValue } from "@/lib/security";

export const ADMIN_SESSION_COOKIE_NAME = "fotm_admin_session";
export const VIEWER_SESSION_COOKIE_NAME = "fotm_viewer_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AdminSessionPayload = {
  spotifyUserId: string;
  issuedAt: string;
};

type ViewerSessionPayload = AdminSessionPayload & {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: string;
};

export type ViewerSessionInput = {
  spotifyUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
};

function encodePayload(payload: AdminSessionPayload | ViewerSessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function buildSignedCookieValue(payload: AdminSessionPayload | ViewerSessionPayload) {
  const encoded = encodePayload(payload);
  const signature = signValue(encoded);

  return `${encoded}.${signature}`;
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

async function setSignedCookie(cookieName: string, value: string) {
  const store = await cookies();
  store.set(cookieName, value, getSessionCookieOptions());
}

function setSignedCookieOnResponse(response: NextResponse, cookieName: string, value: string) {
  response.cookies.set(cookieName, value, getSessionCookieOptions());
}

async function clearSessionCookie(cookieName: string) {
  const store = await cookies();
  store.delete(cookieName);
}

async function readSignedCookie(cookieName: string) {
  const store = await cookies();
  const raw = store.get(cookieName)?.value;
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !verifySignedValue(payload, signature)) {
    return null;
  }

  return payload;
}

function buildAdminSessionPayload(spotifyUserId: string): AdminSessionPayload {
  return {
    spotifyUserId,
    issuedAt: new Date().toISOString(),
  };
}

function buildViewerSessionPayload(input: ViewerSessionInput): ViewerSessionPayload {
  return {
    spotifyUserId: input.spotifyUserId,
    issuedAt: new Date().toISOString(),
    accessTokenEncrypted: encryptValue(input.accessToken),
    refreshTokenEncrypted: encryptValue(input.refreshToken),
    tokenExpiresAt: input.tokenExpiresAt.toISOString(),
  };
}

export async function setAdminSession(spotifyUserId: string) {
  await setSignedCookie(
    ADMIN_SESSION_COOKIE_NAME,
    buildSignedCookieValue(buildAdminSessionPayload(spotifyUserId)),
  );
}

export function setAdminSessionOnResponse(response: NextResponse, spotifyUserId: string) {
  setSignedCookieOnResponse(
    response,
    ADMIN_SESSION_COOKIE_NAME,
    buildSignedCookieValue(buildAdminSessionPayload(spotifyUserId)),
  );
}

export async function clearAdminSession() {
  await clearSessionCookie(ADMIN_SESSION_COOKIE_NAME);
}

export async function getAdminSession() {
  const payload = await readSignedCookie(ADMIN_SESSION_COOKIE_NAME);
  if (!payload) {
    return null;
  }

  try {
    return decodePayload<AdminSessionPayload>(payload);
  } catch {
    return null;
  }
}

export async function setViewerSession(input: ViewerSessionInput) {
  await setSignedCookie(
    VIEWER_SESSION_COOKIE_NAME,
    buildSignedCookieValue(buildViewerSessionPayload(input)),
  );
}

export function setViewerSessionOnResponse(response: NextResponse, input: ViewerSessionInput) {
  setSignedCookieOnResponse(
    response,
    VIEWER_SESSION_COOKIE_NAME,
    buildSignedCookieValue(buildViewerSessionPayload(input)),
  );
}

export async function clearViewerSession() {
  await clearSessionCookie(VIEWER_SESSION_COOKIE_NAME);
}

export async function getViewerSession() {
  const payload = await readSignedCookie(VIEWER_SESSION_COOKIE_NAME);
  if (!payload) {
    return null;
  }

  try {
    const decoded = decodePayload<ViewerSessionPayload>(payload);
    return {
      spotifyUserId: decoded.spotifyUserId,
      issuedAt: decoded.issuedAt,
      accessToken: decryptValue(decoded.accessTokenEncrypted),
      refreshToken: decryptValue(decoded.refreshTokenEncrypted),
      tokenExpiresAt: new Date(decoded.tokenExpiresAt),
    };
  } catch {
    return null;
  }
}
