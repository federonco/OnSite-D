import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { buildEnterUrlFromQrToken } from "@/lib/site-url";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureSectionQrToken } from "@/lib/section-catalog";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sectionId } = await params;
  const userSb = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(userSb)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const ensured = await ensureSectionQrToken(supabase, sectionId);
  if (!ensured) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const url = buildEnterUrlFromQrToken(ensured.qr_token);
  return NextResponse.json({
    qr_token: ensured.qr_token,
    qr_token_issued_at: ensured.qr_token_issued_at,
    url,
  });
}
