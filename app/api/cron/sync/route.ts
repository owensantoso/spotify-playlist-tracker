import { NextRequest, NextResponse } from "next/server";
import { SyncTriggerSource } from "@prisma/client";

import { env } from "@/lib/env";
import { runSync } from "@/lib/services/sync-engine";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggerHeader = request.headers.get("x-trigger-source");
  const triggerSource =
    triggerHeader === "github_actions"
      ? SyncTriggerSource.GITHUB_ACTIONS
      : SyncTriggerSource.CRON;

  const result = await runSync(triggerSource);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
