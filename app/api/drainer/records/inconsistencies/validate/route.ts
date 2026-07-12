import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const ALLOWED_ISSUE_TYPES = new Set(["gap", "overlap", "doubleup"]);

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    section_id: string;
    record_from_id: string;
    record_to_id: string;
    issue_type: "gap" | "overlap" | "doubleup";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { section_id, record_from_id, record_to_id, issue_type } = body;
  if (!section_id || !record_from_id || !record_to_id || !issue_type) {
    return NextResponse.json(
      { error: "Missing section_id, record_from_id, record_to_id, or issue_type" },
      { status: 400 }
    );
  }
  if (!ALLOWED_ISSUE_TYPES.has(issue_type)) {
    return NextResponse.json(
      { error: "issue_type must be gap, overlap, or doubleup" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer({ useServiceRole: true });

  const { error } = await supabase.from("drainer_validated_inconsistencies").insert({
    section_id,
    record_from_id,
    record_to_id,
    issue_type,
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
