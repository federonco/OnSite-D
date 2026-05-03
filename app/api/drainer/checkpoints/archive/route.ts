import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    checkpoint_id,
    section_id,
    name,
    chainage,
    type,
    alert_email,
    last_notified,
  } = body;

  if (
    !checkpoint_id ||
    !name ||
    chainage == null ||
    !type ||
    !last_notified
  ) {
    return NextResponse.json(
      { error: "Missing required fields: checkpoint_id, name, chainage, type, last_notified" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { error } = await supabase.from("checkpoint_history").insert({
    checkpoint_id,
    section_id: section_id || null,
    name: String(name).trim(),
    chainage: Number(chainage),
    type: String(type),
    alert_email: alert_email?.trim() || null,
    last_notified: last_notified,
    expired_at: new Date().toISOString(),
    reason: "auto-expired after 14 days",
  });

  if (error) {
    console.error("checkpoint_history insert failed:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
