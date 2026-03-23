import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { SyncTriggerSource } from "@prisma/client";

import { getAllStatsCacheTags } from "@/lib/cache-tags";
import { getAdminSession } from "@/lib/session";
import { runSync } from "@/lib/services/sync-engine";
import { absoluteUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  console.log("[api/admin/sync] request received");
  const wantsRedirect = request.nextUrl.searchParams.get("redirect") === "1";
  const session = await getAdminSession();
  console.log("[api/admin/sync] session", session?.spotifyUserId ?? "missing");
  if (!session?.spotifyUserId) {
    console.log("[api/admin/sync] unauthorized");
    if (wantsRedirect) {
      return NextResponse.redirect(absoluteUrl("/setup?error=Unauthorized"));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSync(SyncTriggerSource.MANUAL);
  console.log("[api/admin/sync] result", result);
  if (result.ok) {
    getAllStatsCacheTags().forEach((tag) => revalidateTag(tag, "max"));
    revalidatePath("/setup");
    revalidatePath("/admin/logs");
  }
  if (wantsRedirect) {
    if (result.ok) {
      return NextResponse.redirect(
        absoluteUrl(
          `/setup?sync=ok&additions=${result.additionsCount ?? 0}&removals=${result.removalsCount ?? 0}&debug=${encodeURIComponent(
            JSON.stringify(result.debug),
          )}`,
        ),
      );
    }

    return NextResponse.redirect(
      absoluteUrl(`/setup?error=${encodeURIComponent(result.error ?? "Sync failed")}`),
    );
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
