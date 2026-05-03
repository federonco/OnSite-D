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

  let body: { record_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { record_id } = body;
  if (!record_id) {
    return NextResponse.json({ error: "Missing record_id" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });

  const { error } = await supabase.from("drainer_validated_near_tolerance").insert({
    record_id,
    validated_by: user.email ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, message: "Already validated" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
