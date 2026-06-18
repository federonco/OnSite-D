import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchSectionByQrToken, sectionEnterPayload } from "@/lib/section-catalog";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const section = await fetchSectionByQrToken(supabase, token);

  if (!section) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ section: sectionEnterPayload(section) });
}
