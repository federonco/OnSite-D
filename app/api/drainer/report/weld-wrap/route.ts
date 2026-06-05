import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { buildWeldWrapReportData } from "@/lib/reporting/weld-wrap/build-weld-wrap-report";
import { generateWeldWrapPdf } from "@/lib/reporting/weld-wrap/weld-wrap-pdf";
import type { WeldWrapStatusFilterKey } from "@/lib/reporting/weld-wrap/report-filters";

export const runtime = "nodejs";

function parseStatusFilters(raw: unknown): WeldWrapStatusFilterKey[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const allowed = new Set([
    "weld_pending",
    "weld_completed",
    "wrap_pending",
    "wrap_completed",
    "all",
  ]);
  const filters = raw.filter(
    (item): item is WeldWrapStatusFilterKey =>
      typeof item === "string" && allowed.has(item)
  );
  return filters.length > 0 ? filters : undefined;
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userSupabase = getSupabaseServer({ accessToken: token });
  if (!(await isAdmin(userSupabase))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    sectionId?: string;
    statusFilters?: unknown;
  };
  const sectionId = body.sectionId?.trim();
  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const statusFilters = parseStatusFilters(body.statusFilters);
  const { data: reportData, error, status } = await buildWeldWrapReportData(
    supabase,
    sectionId,
    statusFilters
  );

  if (!reportData) {
    return NextResponse.json({ error: error ?? "Report build failed" }, { status });
  }

  try {
    const result = await generateWeldWrapPdf(reportData);
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `inline; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    console.error("[Weld-Wrap] PDF generation failed:", err);
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
