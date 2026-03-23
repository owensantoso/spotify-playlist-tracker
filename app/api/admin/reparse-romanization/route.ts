import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { getAllStatsCacheTags } from "@/lib/cache-tags";
import { getAdminSession } from "@/lib/session";
import { reparseTrackRomanization } from "@/lib/services/setup-service";
import { absoluteUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const wantsRedirect = request.nextUrl.searchParams.get("redirect") === "1";
  const session = await getAdminSession();

  if (!session?.spotifyUserId) {
    if (wantsRedirect) {
      return NextResponse.redirect(absoluteUrl("/setup?error=Unauthorized"));
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updatedCount = await reparseTrackRomanization();
    getAllStatsCacheTags().forEach((tag) => revalidateTag(tag, "max"));
    revalidatePath("/", "layout");
    revalidatePath("/setup");
    revalidatePath("/active");
    revalidatePath("/history");
    revalidatePath("/contributors");

    if (wantsRedirect) {
      return NextResponse.redirect(absoluteUrl(`/setup?reparsed=${updatedCount}`));
    }

    return NextResponse.json({ ok: true, updatedCount });
  } catch (error) {
    if (wantsRedirect) {
      return NextResponse.redirect(
        absoluteUrl(`/setup?error=${encodeURIComponent(String(error))}`),
      );
    }

    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
