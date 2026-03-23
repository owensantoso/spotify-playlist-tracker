import { NextResponse } from "next/server";

import { clearAdminSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/utils";

export async function POST() {
  await clearAdminSession();
  return NextResponse.redirect(absoluteUrl("/"));
}
