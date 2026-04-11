import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const ENTER_SECTION_SELECT =
  "id,name,joint_types,guide_enabled,guide_xml";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { data, error } = await supabase
    .from("drainer_sections")
    .select(ENTER_SECTION_SELECT)
    .eq("qr_token", token)
    .maybeSingle();

  if (error) {
    console.error("[drainer enter GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ section: data });
}
