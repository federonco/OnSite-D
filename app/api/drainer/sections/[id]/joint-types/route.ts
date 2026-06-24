import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCriteriaForSectionId } from "@/lib/analysis-criteria";
import { fetchSectionById } from "@/lib/section-catalog";
import { jointTypesFromAppConfig } from "@/lib/section-app-config";

const ALLOWED_JOINT_TYPES = new Set(["RRJ", "WR", "WB", "Transition"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(getSupabaseServer({ accessToken: token })))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseServer({ useServiceRole: true });
  const section = await fetchSectionById(supabase, id);
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const resolved = await getCriteriaForSectionId(supabase, id);
  const joint_types =
    jointTypesFromAppConfig(resolved.unifiedAppConfig ?? section.app_config) ??
    jointTypesFromAppConfig(section.app_config);

  return NextResponse.json({
    section_id: id,
    section_name: section.name ?? null,
    joint_types: joint_types ?? [],
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
  if (!(await isAdmin(getSupabaseServer({ accessToken: token })))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { joint_types?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.joint_types)) {
    return NextResponse.json({ error: "joint_types must be an array" }, { status: 400 });
  }

  const joint_types = body.joint_types.filter(
    (t): t is string => typeof t === "string" && ALLOWED_JOINT_TYPES.has(t)
  );

  const supabase = getSupabaseServer({ useServiceRole: true });
  const section = await fetchSectionById(supabase, id);
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const resolved = await getCriteriaForSectionId(supabase, id);
  if (!resolved.unifiedSectionId) {
    return NextResponse.json(
      { error: "No mapped unified section; joint_types can only be saved on unified sections." },
      { status: 400 }
    );
  }

  const nextAppConfig: Record<string, unknown> = {
    ...(resolved.unifiedAppConfig ?? {}),
    joint_types,
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
    joint_types,
    linked_unified_section_id: resolved.unifiedSectionId,
  });
}
