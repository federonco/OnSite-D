import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { rejectForeignSubsectionAppId } from "@/lib/drainer-sections-policy";

export async function GET(request: NextRequest) {
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
    .eq("app_id", "onsite-d")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subsections: data ?? [] });
}

export async function POST(request: NextRequest) {
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

  const payload = { ...body, app_id: "onsite-d" } as Record<string, unknown> & {
    app_id: "onsite-d";
  };
  const section_id = payload.section_id;
  const name = payload.name;
  if (typeof section_id !== "string" || !section_id.trim()) {
    return NextResponse.json({ error: "Missing section_id" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const appConfig =
    typeof payload.app_config === "object" &&
    payload.app_config !== null &&
    !Array.isArray(payload.app_config)
      ? payload.app_config
      : {};

  const insert = {
    section_id: section_id.trim(),
    name: name.trim(),
    app_id: "onsite-d",
    start_ch: payload.start_ch != null ? Number(payload.start_ch) : null,
    end_ch: payload.end_ch != null ? Number(payload.end_ch) : null,
    direction:
      typeof payload.direction === "string" ? payload.direction : null,
    app_config: appConfig,
    is_active: payload.is_active !== false,
    location_id:
      typeof payload.location_id === "string" ? payload.location_id : null,
    qr_token:
      typeof payload.qr_token === "string" ? payload.qr_token : null,
    qr_token_issued_at:
      typeof payload.qr_token_issued_at === "string"
        ? payload.qr_token_issued_at
        : null,
  };

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("subsections")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subsection: data });
}
