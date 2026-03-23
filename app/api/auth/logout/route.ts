import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { clearAdminSession, clearViewerSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/utils";

export async function POST() {
  await Promise.all([clearAdminSession(), clearViewerSession()]);
  revalidatePath("/");
  revalidatePath("/active");
  revalidatePath("/history");
  revalidatePath("/contributors");
  revalidatePath("/setup");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/logs");
  return NextResponse.redirect(absoluteUrl("/"));
}
