import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const chainage = searchParams.get("chainage");
  const excludeRecordId = searchParams.get("excludeRecordId");

  if (!sectionId || chainage == null || chainage === "") {
    return NextResponse.json(
      { error: "Missing sectionId or chainage" },
      { status: 400 }
    );
  }

  const ch = Number(chainage);
  if (!Number.isFinite(ch)) {
    return NextResponse.json(
      { error: "Invalid chainage" },
      { status: 400 }
    );
  }

  const { token } = await getUserFromRequest(request);
  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  let query = supabase
    .from("drainer_pipe_records")
    .select("id,chainage,pipe_fitting_id")
    .eq("section_id", sectionId)
    .eq("chainage", ch);
  if (excludeRecordId) {
    query = query.neq("id", excludeRecordId);
  }
  const { data: rows, error } = await query.limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const existing = rows?.[0] ?? null;
  return NextResponse.json({
    duplicate: !!existing,
    existing: existing
      ? { id: existing.id, chainage: existing.chainage, pipe_fitting_id: existing.pipe_fitting_id }
      : null,
  });
}
