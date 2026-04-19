import { NextResponse } from "next/server";

export const DASHBOARD_SECTIONS_URL =
  "https://apa-dashboard.readx.com.au/admin/sections";

export function sectionsWriteForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Section creation not allowed from OnSite-D",
      message: "Sections must be created from Dashboard admin",
      dashboard_url: DASHBOARD_SECTIONS_URL,
    },
    { status: 403 }
  );
}

/** Reject writes when client sends a different app_id; OnSite-D only manages onsite-d. */
export function rejectForeignSubsectionAppId(
  body: Record<string, unknown>
): NextResponse | null {
  if (body.app_id != null && body.app_id !== "onsite-d") {
    return NextResponse.json(
      {
        error: "OnSite-D can only manage subsections with app_id='onsite-d'",
      },
      { status: 403 }
    );
  }
  return null;
}
