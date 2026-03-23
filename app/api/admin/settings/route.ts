import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/session";
import { updateSettings } from "@/lib/services/settings-service";
import { absoluteUrl } from "@/lib/utils";

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

const settingsSchema = z.object({
  mainPlaylistId: z.string().min(1),
  archivePlaylistId: z.string().min(1),
  syncIntervalMinutes: z.coerce.number().int().min(15).max(24 * 60),
  discordWebhookUrl: z.union([z.literal(""), z.string().url()]),
  notifyOnAdditions: z.boolean(),
  notifyOnRemovals: z.boolean(),
  batchedNotifications: z.boolean(),
  publicDashboard: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.spotifyUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = settingsSchema.safeParse({
    mainPlaylistId: String(formData.get("mainPlaylistId") ?? "").trim(),
    archivePlaylistId: String(formData.get("archivePlaylistId") ?? "").trim(),
    syncIntervalMinutes: formData.get("syncIntervalMinutes") ?? 60,
    discordWebhookUrl: String(formData.get("discordWebhookUrl") ?? "").trim(),
    notifyOnAdditions: parseBoolean(formData.get("notifyOnAdditions")),
    notifyOnRemovals: parseBoolean(formData.get("notifyOnRemovals")),
    batchedNotifications: parseBoolean(formData.get("batchedNotifications")),
    publicDashboard: parseBoolean(formData.get("publicDashboard")),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      absoluteUrl(
        `/admin/settings?error=${encodeURIComponent(
          parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        )}`,
      ),
    );
  }

  await updateSettings({
    mainPlaylistId: parsed.data.mainPlaylistId,
    archivePlaylistId: parsed.data.archivePlaylistId,
    syncIntervalMinutes: parsed.data.syncIntervalMinutes,
    discordWebhookUrl: parsed.data.discordWebhookUrl || null,
    notifyOnAdditions: parsed.data.notifyOnAdditions,
    notifyOnRemovals: parsed.data.notifyOnRemovals,
    batchedNotifications: parsed.data.batchedNotifications,
    publicDashboard: parsed.data.publicDashboard,
  });

  return NextResponse.redirect(absoluteUrl("/admin/settings?saved=1"));
}
