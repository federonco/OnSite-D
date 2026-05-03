import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { buildEnterUrlFromQrToken } from "@/lib/site-url";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sectionId } = await params;
  const supabase = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("drainer_sections")
    .select("id, qr_token, qr_token_issued_at")
    .eq("id", sectionId)
    .maybeSingle();

  if (fetchError) {
    console.error("[sections qr POST] fetch failed:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  let qr_token = row.qr_token as string | null;
  let qr_token_issued_at = row.qr_token_issued_at as string | null;

  if (!qr_token) {
    qr_token = crypto.randomUUID();
    const issued = new Date().toISOString();
    const { data: updated, error: upError } = await supabase
      .from("drainer_sections")
      .update({
        qr_token,
        qr_token_issued_at: issued,
      })
      .eq("id", sectionId)
      .select("qr_token, qr_token_issued_at")
      .single();

    if (upError || !updated) {
      console.error("[sections qr POST] update failed:", upError?.message);
      return NextResponse.json(
        { error: upError?.message ?? "Failed to save QR token" },
        { status: 500 }
      );
    }
    qr_token = updated.qr_token as string;
    qr_token_issued_at = updated.qr_token_issued_at as string | null;
  }

  const url = buildEnterUrlFromQrToken(qr_token);
  return NextResponse.json({
    qr_token,
    qr_token_issued_at,
    url,
  });
}
