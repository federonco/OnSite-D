import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { normalizeGuideItemsForSave, validateGuideItemsPayload } from "@/lib/guide-csv";
import { guideConfigFromAppConfig } from "@/lib/section-app-config";
import { fetchUnifiedSectionByCatalogId } from "@/lib/section-catalog";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, token } = await getUserFromRequest(_request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(getSupabaseServer({ accessToken: token })))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseServer({ useServiceRole: true });
  const unified = await fetchUnifiedSectionByCatalogId(supabase, id);
  if (!unified) {
    return NextResponse.json(
      { error: "No unified section found for this catalog id" },
      { status: 404 }
    );
  }

  const cfg = guideConfigFromAppConfig(unified.app_config ?? null);
  return NextResponse.json({
    section_id: id,
    unified_section_id: unified.id,
    guide_xml: cfg.guide_xml ?? [],
    guide_enabled: cfg.guide_enabled,
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
  let body: { guide_xml?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateGuideItemsPayload(body.guide_xml);
  if (!validated) {
    return NextResponse.json(
      { error: "guide_xml must be an array of { item_id: string, sequence_number: number }" },
      { status: 400 }
    );
  }

  const normalized = normalizeGuideItemsForSave(validated);
  const guide_enabled = normalized.length >= 1;

  const supabase = getSupabaseServer({ useServiceRole: true });
  const unified = await fetchUnifiedSectionByCatalogId(supabase, id);
  if (!unified) {
    return NextResponse.json(
      { error: "No unified section found for this catalog id" },
      { status: 404 }
    );
  }

  const { data: current, error: readError } = await supabase
    .from("sections")
    .select("app_config")
    .eq("id", unified.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const existingConfig =
    current?.app_config &&
    typeof current.app_config === "object" &&
    !Array.isArray(current.app_config)
      ? (current.app_config as Record<string, unknown>)
      : {};

  const nextAppConfig: Record<string, unknown> = {
    ...existingConfig,
    guide_xml: normalized,
    guide_enabled,
  };

  const { error } = await supabase
    .from("sections")
    .update({ app_config: nextAppConfig })
    .eq("id", unified.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    section_id: id,
    unified_section_id: unified.id,
    guide_xml: normalized,
    guide_enabled,
  });
}
