import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    checkpoint_id,
    section_id,
    name,
    ch,
    type,
    alert_email,
    notified_at,
  } = body;

  if (
    !checkpoint_id ||
    !name ||
    ch == null ||
    !type ||
    !notified_at
  ) {
    return NextResponse.json(
      { error: "Missing required fields: checkpoint_id, name, ch, type, notified_at" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { error } = await supabase.from("checkpoint_history").insert({
    checkpoint_id,
    section_id: section_id || null,
    name: String(name).trim(),
    ch: Number(ch),
    type: String(type),
    alert_email: alert_email?.trim() || null,
    notified_at: notified_at,
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
