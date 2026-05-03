import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateAuditReportPdf } from "@/lib/reporting/audit-report-pdf";
import { fetchAuditSectionById } from "@/lib/drainer-sections-read";
import { createEmailTransporter, getEmailFrom, getEmailSignatureHtml, getLogoAttachment, hasEmailConfig, LOGO_CID } from "@/lib/email-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sectionId, recipientEmail } = body;

  if (!sectionId) {
    return NextResponse.json(
      { error: "Missing sectionId" },
      { status: 400 }
    );
  }

  const recipient =
    recipientEmail?.trim() ||
    process.env.REPORT_DEFAULT_EMAIL ||
    user.email;
  if (!recipient) {
    return NextResponse.json(
      { error: "Recipient email required" },
      { status: 400 }
    );
  }

  const { section, error: sectionErr } = await fetchAuditSectionById(supabase, sectionId);
  if (!section) {
    return NextResponse.json(
      { error: sectionErr?.message ?? "Section not found" },
      { status: 404 }
    );
  }

  const { data: records, error: recordsError } = await supabase
    .from("drainer_pipe_records")
    .select("*")
    .eq("section_id", sectionId)
    .order("date_installed", { ascending: true })
    .order("chainage", { ascending: true });

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }

  const { buffer, fileName } = await generateAuditReportPdf({
    section,
    records: records ?? [],
    generatedBy: user?.email ?? undefined,
  });

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  const text = `Please find attached the full audit report for ${section.name}.`;
  const logoAttachment = getLogoAttachment();
  const logoSrc = logoAttachment ? `cid:${LOGO_CID}` : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">Audit Report</h2>
  <p>Please find the attached full audit report for <strong>${section.name}</strong>.</p>
  <p style="color: #666; font-size: 13px;">This report was generated automatically by OnSite-D.</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>
`;

  const attachments: Array<{ filename: string; content: Buffer; contentType?: string; cid?: string }> = [
    { filename: fileName, content: buffer, contentType: "application/pdf" },
  ];
  const logoAtt = getLogoAttachment();
  if (logoAtt) attachments.unshift(logoAtt);

  try {
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: getEmailFrom(),
      to: recipient,
      subject: `Audit Report — ${section.name}`,
      text,
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({ ok: true, message: "Email sent" });
  } catch (err) {
    console.error("Audit email failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Email failed" },
      { status: 500 }
    );
  }
}
