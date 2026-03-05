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

  const { data: maxRow } = await supabase
    .from("drainer_pipe_records")
    .select("chainage")
    .order("chainage", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxChainage = maxRow?.chainage != null ? Number(maxRow.chainage) : null;

  if (maxChainage == null) {
    return NextResponse.json({ missed: [], maxChainage: null });
  }

  const { data: missed, error } = await supabase
    .from("checkpoints")
    .select("id,name,ch")
    .eq("active", true)
    .eq("notified", false)
    .lt("ch", maxChainage)
    .order("ch", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    missed: (missed ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      ch: Number(m.ch),
      detected_at_ch: maxChainage,
    })),
  });
}
