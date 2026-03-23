import "server-only";

import { unstable_cache } from "next/cache";

import { cacheTags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

const readAppSettingsCached = unstable_cache(
  async () => db.appSettings.findUnique({ where: { id: 1 } }),
  ["app-settings"],
  {
    tags: [cacheTags.appSettings],
    revalidate: 60 * 5,
  },
);

export async function getCachedSettings() {
  try {
    return await readAppSettingsCached();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return null;
    }

    throw error;
  }
}

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
