import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_CRITERIA,
  getCriteriaForDrainerSection,
  mergeCriteria,
  type AnalysisCriteria,
} from "@/lib/analysis-criteria";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing section id" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { data: drainerSection } = await supabase
    .from("drainer_sections")
    .select("id,name")
    .eq("id", id)
    .maybeSingle();

  if (!drainerSection) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const resolved = await getCriteriaForDrainerSection(supabase, id);
  return NextResponse.json({
    section_id: id,
    section_name: drainerSection.name ?? null,
    criteria: resolved.criteria,
    defaults: DEFAULT_CRITERIA,
    linked_unified_section_id: resolved.unifiedSectionId,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing section id" }, { status: 400 });
  }

  let body: Partial<AnalysisCriteria>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { data: drainerSection } = await supabase
    .from("drainer_sections")
    .select("id,name")
    .eq("id", id)
    .maybeSingle();

  if (!drainerSection) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const resolved = await getCriteriaForDrainerSection(supabase, id);
  if (!resolved.unifiedSectionId) {
    return NextResponse.json({
      section_id: id,
      section_name: drainerSection.name ?? null,
      criteria: DEFAULT_CRITERIA,
      defaults: DEFAULT_CRITERIA,
      linked_unified_section_id: null,
      message: "No mapped unified section found (legacy_id). Returned defaults only.",
    });
  }

  const merged = mergeCriteria({
    ...resolved.criteria,
    ...body,
  });

  const nextAppConfig: Record<string, unknown> = {
    ...(resolved.unifiedAppConfig ?? {}),
    analysis_criteria: merged,
  };

  const { error } = await supabase
    .from("sections")
    .update({ app_config: nextAppConfig })
    .eq("id", resolved.unifiedSectionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    section_id: id,
    section_name: drainerSection.name ?? null,
    criteria: merged,
    defaults: DEFAULT_CRITERIA,
    linked_unified_section_id: resolved.unifiedSectionId,
  });
}
