import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Returns total count of pending alerts (gap + overlap + doubleup). */
export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin =
    request.headers.get("x-forwarded-proto") && request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl?.origin ?? "http://localhost:3000";

  const headers = { Authorization: `Bearer ${token}` };

  try {
    const incRes = await fetch(`${origin}/api/drainer/records/inconsistencies`, { headers });
    const incData = await incRes.json();

    const count = (incData.sections ?? (incData.section_id ? [incData] : [])).reduce(
      (s: number, sec: { inconsistencies?: unknown[] }) =>
        s + (sec.inconsistencies?.length ?? 0),
      0
    );

    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
