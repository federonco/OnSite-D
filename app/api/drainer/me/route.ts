import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin, isSuperAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ email: null, isAdmin: false, isSuperAdmin: false });
  }
  const supabase = getSupabaseServer({ accessToken: token });
  const adminStatus = await isAdmin(supabase);
  const superAdminStatus = await isSuperAdmin(supabase);
  return NextResponse.json({
    email: user.email,
    isAdmin: adminStatus,
    isSuperAdmin: superAdminStatus,
    reportDefaultEmail: process.env.REPORT_DEFAULT_EMAIL || user.email,
  });
}
