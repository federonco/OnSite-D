import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  if ("joint_types" in body) {
    const raw = body.joint_types;
    if (Array.isArray(raw)) {
      const cleaned = raw
        .map((x: unknown) => String(x).trim())
        .filter(Boolean);
      updates.joint_types = cleaned.length > 0 ? cleaned : null;
    } else if (raw === null) {
      updates.joint_types = null;
    }
  }
  if ("guide_enabled" in body) {
    updates.guide_enabled = Boolean(body.guide_enabled);
  }
  if ("guide_xml" in body) {
    const gx = body.guide_xml;
    if (gx === null) {
      updates.guide_xml = null;
    } else if (Array.isArray(gx)) {
      const rows: { sequence_number: number; item_id: string }[] = [];
      for (const row of gx) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const id = o.item_id;
        if (typeof id !== "string" || id.trim() === "") continue;
        const n = Number(o.sequence_number);
        if (!Number.isFinite(n)) continue;
        rows.push({ sequence_number: n, item_id: id.trim() });
      }
      rows.sort((a, b) => a.sequence_number - b.sequence_number);
      updates.guide_xml = rows.length > 0 ? rows : null;
    }
  }

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

  // Sync shared fields to unified sections table.
  const sectionSyncUpdates: Record<string, unknown> = {};
  if ("name" in body && body.name !== undefined) {
    sectionSyncUpdates.name = String(body.name);
  }
  if ("start_ch" in body && body.start_ch !== undefined) {
    sectionSyncUpdates.start_ch = body.start_ch != null ? Number(body.start_ch) : null;
  }
  if ("end_ch" in body && body.end_ch !== undefined) {
    sectionSyncUpdates.end_ch = body.end_ch != null ? Number(body.end_ch) : null;
  }
  if ("direction" in body && body.direction !== undefined) {
    sectionSyncUpdates.direction = body.direction || null;
  }

  if (Object.keys(sectionSyncUpdates).length > 0) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error: syncError } = await supabaseAdmin
      .from("sections")
      .update(sectionSyncUpdates)
      .eq("app_config->>legacy_id", id);
    if (syncError) {
      console.error("[sections sync PUT] update failed:", syncError.message, syncError.details, syncError.hint);
      return NextResponse.json({ error: syncError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    section: data ? { ...data, projects: null } : data,
  });
}
