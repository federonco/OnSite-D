import type { NextRequest } from "next/server";

/**
 * Public base URL for links and QR codes.
 * Prefer NEXT_PUBLIC_SITE_URL, then Vercel deployment URL, then the incoming request origin.
 */
export function getPublicSiteUrlFromRequest(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL.replace(/\/$/, "");
    return v.startsWith("http") ? v : `https://${v}`;
  }

  return request.nextUrl.origin;
}

/** For server-only email (no Request), e.g. section create QR email. */
export function getPublicSiteUrlFromEnv(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL.replace(/\/$/, "");
    return v.startsWith("http") ? v : `https://${v}`;
  }

  return "https://onsite-d.vercel.app";
}
