import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/session";
import { seedArchiveEntriesFromRemoteArchive } from "@/lib/services/setup-service";
import { absoluteUrl } from "@/lib/utils";

export async function POST() {
  const session = await getAdminSession();
  if (!session?.spotifyUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seededCount = await seedArchiveEntriesFromRemoteArchive();
  return NextResponse.redirect(absoluteUrl(`/setup?seeded=${seededCount}`));
}
