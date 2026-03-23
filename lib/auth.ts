import "server-only";

import { redirect } from "next/navigation";

import { getAdminAccount } from "@/lib/services/admin-service";
import { getAdminSession } from "@/lib/session";

export async function isAuthenticatedAdmin() {
  const session = await getAdminSession();
  return Boolean(session?.spotifyUserId);
}

export async function requireAuthenticatedAdmin() {
  const session = await getAdminSession();
  if (!session?.spotifyUserId) {
    redirect("/setup");
  }

  return session;
}

export async function getCurrentAdminContext() {
  const [session, account] = await Promise.all([getAdminSession(), getAdminAccount()]);

  return {
    session,
    account,
    isAuthenticated: Boolean(session?.spotifyUserId),
    isConfigured: Boolean(account),
  };
}
