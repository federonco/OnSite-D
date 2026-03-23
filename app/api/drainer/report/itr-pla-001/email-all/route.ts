import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateITRPla001PdfWithFallback } from "@/lib/reporting/itr-pla-001/generate-with-fallback";
import { ITR_PAGE_SIZE, groupRecordsIntoITRs } from "@/lib/drainer";
import {
  createEmailTransporter,
  getEmailFrom,
  getEmailSignatureHtml,
  getLogoAttachment,
  hasEmailConfig,
  LOGO_CID,
} from "@/lib/email-config";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { sectionId, recipientEmail } = body;

  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
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

  const supabase = getSupabaseServer({ accessToken: token });

  const { data: section, error: sectionError } = await supabase
    .from("drainer_sections")
    .select("id,name,project_name,project_number,itp_number")
    .eq("id", sectionId)
    .single();

  if (sectionError || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const { data: allRecords, error: recordsError } = await supabase
    .from("drainer_pipe_records")
    .select("*")
    .eq("section_id", sectionId)
    .order("chainage", { ascending: false });

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }

  const records = allRecords ?? [];
  const pages = groupRecordsIntoITRs(records);

  if (pages.length === 0) {
    return NextResponse.json(
      { error: "No records to generate ITR reports" },
      { status: 400 }
    );
  }

  const pdfBuffers: Buffer[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageRecords = pages[i];
    const itrIndex = i + 1;
    const totalPages = pages.length;
    const isOpenITR = pageRecords.length < ITR_PAGE_SIZE;

    try {
      const result = await generateITRPla001PdfWithFallback(
        section,
        pageRecords,
        itrIndex,
        totalPages,
        { isOpenITR }
      );
      pdfBuffers.push(result.buffer);
    } catch (error) {
      console.error(`[ITR-PLA-001] PDF generation failed for ITR-${itrIndex}:`, error);
      const msg = (error as Error)?.message ?? String(error ?? "");
      return NextResponse.json(
        { error: `ITR-${itrIndex} PDF failed: ${msg}` },
        { status: 500 }
      );
    }
  }

  let mergedBuffer: Buffer;
  try {
    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const pdf = await PDFDocument.load(buf);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const mergedBytes = await mergedPdf.save();
    mergedBuffer = Buffer.from(mergedBytes);
  } catch (error) {
    console.error("[ITR-PLA-001] PDF merge failed:", error);
    return NextResponse.json(
      { error: "Failed to merge PDFs" },
      { status: 500 }
    );
  }

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  const fileName = `ITR-PLA-001_${safeName}_All-ITRs_${Date.now()}.pdf`;
  const subject = `ITR-PLA-001 — ${section.name} — All ITRs (${pages.length} pages)`;
  const text = `Please find attached all ITR reports for ${section.name} (${pages.length} ITR pages combined).`;
  const logoAttachment = getLogoAttachment();
  const logoSrc = logoAttachment
    ? `cid:${LOGO_CID}`
    : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">ITR-PLA-001 — All Reports</h2>
  <p>Please find the attached combined ITR report for <strong>${section.name}</strong> (${pages.length} ITR pages).</p>
  <p style="color: #666; font-size: 13px;">This report was generated automatically by OnSite-D.</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>
`;

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
    cid?: string;
  }> = [{ filename: fileName, content: mergedBuffer, contentType: "application/pdf" }];
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
    console.error("[ITR-PLA-001] sendMail failed:", { message: msg, error: err });
    return NextResponse.json(
      { error: "Email failed. PDF was generated but could not be sent." },
      { status: 500 }
    );
  }
}
