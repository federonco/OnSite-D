import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ email: null, isAdmin: false });
  }
  return NextResponse.json({
    email: user.email,
    isAdmin: isAdminEmail(user.email),
    reportDefaultEmail: process.env.REPORT_DEFAULT_EMAIL || user.email,
  });
}
