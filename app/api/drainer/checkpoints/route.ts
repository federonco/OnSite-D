import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

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
    .from("checkpoints")
    .select("*")
    .order("chainage", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkpoints: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, chainage, type, is_active, alert_email } = body;

  if (!name || chainage == null) {
    return NextResponse.json(
      { error: "Missing name or chainage" },
      { status: 400 }
    );
  }

  const validTypes = ["Fitting", "Structural", "Warning", "Info"];
  const typeVal = validTypes.includes(type) ? type : "Info";

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("checkpoints")
    .insert({
      name: String(name).trim(),
      chainage: Number(chainage),
      type: typeVal,
      is_active: is_active !== false,
      alert_email: alert_email?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkpoint: data });
}
