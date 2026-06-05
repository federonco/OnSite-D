import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { buildWeldWrapReportData } from "@/lib/reporting/weld-wrap/build-weld-wrap-report";
import { generateWeldWrapPdf } from "@/lib/reporting/weld-wrap/weld-wrap-pdf";
import type { WeldWrapStatusFilterKey } from "@/lib/reporting/weld-wrap/report-filters";
import {
  createEmailTransporter,
  getEmailFrom,
  getEmailSignatureHtml,
  getLogoAttachment,
  hasEmailConfig,
  LOGO_CID,
} from "@/lib/email-config";

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
    recipientEmail?: string;
    statusFilters?: unknown;
  };
  const { sectionId, recipientEmail } = body;

  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const recipient =
    recipientEmail?.trim() ||
    process.env.REPORT_DEFAULT_EMAIL ||
    user.email;
  if (!recipient) {
    return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
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

  const backfillUpTo = reportData.sectionContext?.backfillUpTo ?? null;

  let buffer: Buffer;
  let fileName: string;
  try {
    const result = await generateWeldWrapPdf(reportData);
    buffer = result.buffer;
    fileName = result.fileName;
  } catch (err) {
    console.error("[Weld-Wrap] PDF generation failed:", err);
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { error: `Weld & Wrap PDF generation failed: ${msg}` },
      { status: 500 }
    );
  }

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  const { section, summary } = reportData;
  const subject = `Weld & Wrap — ${section.name} — Status`;
  const text = [
    `Weld & Wrap status report for ${section.name}.`,
    `Showing: ${reportData.filterLabel}`,
    `Backfill up to: ${backfillUpTo != null ? `CH ${backfillUpTo}` : "—"}`,
    `WR/TR welds: ${summary.wrWeldsDone} done, ${summary.wrWeldsPending} pending.`,
    `WB welds: ${summary.wbWeldsDone} done, ${summary.wbWeldsPending} pending.`,
    `Wrap: ${summary.wrapsDone} done, ${summary.wrapsPending} pending.`,
    "",
    "Please find the attached PDF.",
  ].join("\n");

  const logoAttachment = getLogoAttachment();
  const logoSrc = logoAttachment
    ? `cid:${LOGO_CID}`
    : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">Weld &amp; Wrap Status Report</h2>
  <p>Please find the attached status report for <strong>${section.name}</strong>.</p>
  <p style="font-size: 13px; color: #555;">Showing: ${reportData.filterLabel}</p>
  <p style="font-size: 13px; color: #555;">
    WR/TR welds: ${summary.wrWeldsDone} done / ${summary.wrWeldsPending} pending &nbsp;|&nbsp;
    WB welds: ${summary.wbWeldsDone} done / ${summary.wbWeldsPending} pending &nbsp;|&nbsp;
    Wrap: ${summary.wrapsDone} done / ${summary.wrapsPending} pending
  </p>
  <p style="color: #666; font-size: 13px;">This report was generated automatically by OnSite-D.</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>
`;

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
    cid?: string;
  }> = [{ filename: fileName, content: buffer, contentType: "application/pdf" }];
  const logoAtt = getLogoAttachment();
  if (logoAtt) attachments.unshift(logoAtt);

  try {
    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: getEmailFrom(),
      to: recipient,
      subject,
      text,
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({ ok: true, message: "Email sent" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Weld-Wrap] sendMail failed:", { message: msg, stack, error: err });
    return NextResponse.json(
      { error: "Email failed. PDF was generated but could not be sent." },
      { status: 500 }
    );
  }
}
