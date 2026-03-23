import "server-only";

import { env } from "@/lib/env";
import { buildDiscordMessage, type AdditionPayload } from "@/lib/notifications/discord";
import { getOrCreateSettings } from "@/lib/services/settings-service";

export type NotificationResult = {
  sentCount: number;
  failedCount: number;
  warnings: string[];
};

export async function sendAdditionNotifications(payload: AdditionPayload): Promise<NotificationResult> {
  const settings = await getOrCreateSettings();
  if (!settings.notifyOnAdditions) {
    return { sentCount: 0, failedCount: 0, warnings: [] };
  }

  const webhookUrl = settings.discordWebhookUrl ?? env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || payload.lifecycles.length === 0) {
    return { sentCount: 0, failedCount: 0, warnings: [] };
  }

  const bodies = buildDiscordMessage(payload, settings.batchedNotifications);
  const messages = Array.isArray(bodies) ? bodies : [bodies];
  let sentCount = 0;
  let failedCount = 0;
  const warnings: string[] = [];

  for (const body of messages) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        failedCount += 1;
        warnings.push(`Discord webhook failed with status ${response.status}`);
        continue;
      }

      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      warnings.push(`Discord webhook request failed: ${String(error)}`);
    }
  }

  return { sentCount, failedCount, warnings };
}
