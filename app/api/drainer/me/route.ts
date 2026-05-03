import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ email: null, isAdmin: false });
  }
  const supabase = getSupabaseServer({ accessToken: token });
  const adminStatus = await isAdmin(supabase);
  return NextResponse.json({
    email: user.email,
    isAdmin: adminStatus,
    reportDefaultEmail: process.env.REPORT_DEFAULT_EMAIL || user.email,
  });
}
