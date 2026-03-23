import "server-only";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function getOrCreateSettings() {
  const existing = await db.appSettings.findUnique({ where: { id: 1 } });
  if (existing) {
    return existing;
  }

  return db.appSettings.create({
    data: {
      id: 1,
      mainPlaylistId: env.MAIN_PLAYLIST_ID,
      archivePlaylistId: env.ARCHIVE_PLAYLIST_ID,
      syncIntervalMinutes: env.SYNC_INTERVAL_MINUTES,
      discordWebhookUrl: env.DISCORD_WEBHOOK_URL,
      notifyOnAdditions: false,
      notifyOnRemovals: false,
      batchedNotifications: true,
      archiveDedupeEnabled: true,
      publicDashboard: true,
    },
  });
}

export async function updateSettings(
  data: Partial<{
    mainPlaylistId: string;
    archivePlaylistId: string;
    syncIntervalMinutes: number;
    discordWebhookUrl: string | null;
    notifyOnAdditions: boolean;
    notifyOnRemovals: boolean;
    batchedNotifications: boolean;
    publicDashboard: boolean;
  }>,
) {
  await getOrCreateSettings();
  return db.appSettings.update({
    where: { id: 1 },
    data,
  });
}
