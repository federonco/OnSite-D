import { NextResponse } from "next/server";
import { hasEmailConfig } from "@/lib/email-config";

/** GET /api/health/email — verify email config (RESEND_API_KEY) */
export async function GET() {
  const ok = hasEmailConfig();
  return NextResponse.json({
    emailConfigured: ok,
    message: ok ? "RESEND_API_KEY is set" : "RESEND_API_KEY missing or invalid (use real key, not placeholder)",
  });
}
