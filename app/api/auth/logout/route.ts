import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { clearAdminSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/utils";

export async function POST() {
  await clearAdminSession();
  revalidatePath("/setup");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/logs");
  return NextResponse.redirect(absoluteUrl("/"));
}
