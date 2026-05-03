import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";

  const { data: observations, error } = await supabase
    .from("drainer_observations")
    .select("id, section_id, chainage, pipe_fitting_id, description, submitted_by, created_at, status, approval_comment, approved_by, approved_at")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!observations?.length) {
    return NextResponse.json({ observations: [] });
  }

  const sectionIds = [...new Set(observations.map((o) => o.section_id))];
  const { data: sections } = await supabase
    .from("drainer_sections")
    .select("id, name")
    .in("id", sectionIds);

  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.name ?? s.id]));

  const enriched = observations.map((o) => ({
    ...o,
    section_name: sectionMap.get(o.section_id) ?? o.section_id,
  }));

  return NextResponse.json({ observations: enriched });
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { section_id: string; chainage: number; pipe_fitting_id?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.section_id || body.chainage == null) {
    return NextResponse.json({ error: "section_id and chainage required" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ accessToken: token });

  const { data, error } = await supabase
    .from("drainer_observations")
    .insert({
      section_id: body.section_id,
      chainage: body.chainage,
      pipe_fitting_id: body.pipe_fitting_id ?? null,
      description: body.description ?? null,
      submitted_by: user.email ?? "unknown",
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
