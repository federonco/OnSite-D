import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DRAINER_SECTION_BASE } from "@/lib/drainer-sections-read";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, start_ch, end_ch, direction, project_id, itp_number } = body;

  if (!name) {
    return NextResponse.json({ error: "Missing section name" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    name: String(name),
    start_ch: start_ch != null ? Number(start_ch) : null,
    end_ch: end_ch != null ? Number(end_ch) : null,
    direction: direction || null,
    project_id: project_id ?? null,
    itp_number: itp_number || null,
  };

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("drainer_sections")
    .update(updates)
    .eq("id", id)
    .select(DRAINER_SECTION_BASE)
    .single();

  if (error) {
    console.error("[drainer_sections PUT] update failed:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    section: data ? { ...data, projects: null } : data,
  });
}
