import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { rejectForeignSubsectionAppId } from "@/lib/drainer-sections-policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("subsections")
    .select("*")
    .eq("id", id)
    .eq("app_id", "onsite-d")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ subsection: data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const denied = rejectForeignSubsectionAppId(body);
  if (denied) return denied;

  const payload = { ...body, app_id: "onsite-d" as const };

  const updates: Record<string, unknown> = {
    app_id: "onsite-d",
  };
  if ("section_id" in payload && typeof payload.section_id === "string") {
    updates.section_id = payload.section_id;
  }
  if ("name" in payload && typeof payload.name === "string") {
    updates.name = payload.name.trim();
  }
  if ("start_ch" in payload) {
    updates.start_ch =
      payload.start_ch != null ? Number(payload.start_ch) : null;
  }
  if ("end_ch" in payload) {
    updates.end_ch = payload.end_ch != null ? Number(payload.end_ch) : null;
  }
  if ("direction" in payload) {
    updates.direction =
      typeof payload.direction === "string" ? payload.direction : null;
  }
  if ("app_config" in payload) {
    const ac = payload.app_config;
    updates.app_config =
      typeof ac === "object" && ac !== null && !Array.isArray(ac) ? ac : {};
  }
  if ("is_active" in payload) {
    updates.is_active = Boolean(payload.is_active);
  }
  if ("location_id" in payload) {
    updates.location_id =
      typeof payload.location_id === "string" ? payload.location_id : null;
  }
  if ("qr_token" in payload) {
    updates.qr_token =
      typeof payload.qr_token === "string" ? payload.qr_token : null;
  }
  if ("qr_token_issued_at" in payload) {
    updates.qr_token_issued_at =
      typeof payload.qr_token_issued_at === "string"
        ? payload.qr_token_issued_at
        : null;
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("subsections")
    .update(updates)
    .eq("id", id)
    .eq("app_id", "onsite-d")
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subsection: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, token } = await getUserFromRequest(_request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const { error } = await supabase
    .from("subsections")
    .delete()
    .eq("id", id)
    .eq("app_id", "onsite-d");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
