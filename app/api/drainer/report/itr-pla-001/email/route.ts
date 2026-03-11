import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateITRPla001PdfWithFallback } from "@/lib/reporting/itr-pla-001";
import { ITR_PAGE_SIZE } from "@/lib/drainer";
import { createEmailTransporter, getEmailFrom, getEmailSignatureHtml, getLogoAttachment, hasEmailConfig, LOGO_CID } from "@/lib/email-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  console.log("[ITR-PLA-001] email route: start");
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { sectionId, itrIndex, recipientEmail } = body;

  if (!sectionId || !itrIndex || typeof itrIndex !== "number") {
    return NextResponse.json(
      { error: "Missing sectionId or itrIndex" },
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
  const startIdx = (itrIndex - 1) * ITR_PAGE_SIZE;
  const pageRecords = records.slice(startIdx, startIdx + ITR_PAGE_SIZE);

  if (pageRecords.length === 0) {
    return NextResponse.json(
      { error: `ITR-${itrIndex} has no records` },
      { status: 400 }
    );
  }
  if (pageRecords.length > ITR_PAGE_SIZE) {
    return NextResponse.json(
      { error: `ITR-PLA-001 supports a maximum of ${ITR_PAGE_SIZE} rows per page. Received ${pageRecords.length}.` },
      { status: 400 }
    );
  }

  const totalPages = Math.ceil(records.length / ITR_PAGE_SIZE);
  const isOpenITR = pageRecords.length < ITR_PAGE_SIZE;
  let buffer: Buffer;
  let fileName: string;
  console.log("[ITR-PLA-001] email route: before PDF generation", { sectionId, itrIndex, recordsCount: pageRecords.length });
  try {
    const result = await generateITRPla001PdfWithFallback(
      section,
      pageRecords,
      itrIndex,
      totalPages,
      { isOpenITR }
    );
    buffer = result.buffer;
    fileName = result.fileName;
    console.log("[ITR-PLA-001] email route: after PDF generation", {
      bufferSize: buffer?.length ?? 0,
      fileName,
      source: result.source,
    });
  } catch (pdfErr) {
    const msg = pdfErr instanceof Error ? pdfErr.message : "PDF generation failed";
    const stack = pdfErr instanceof Error ? pdfErr.stack : undefined;
    console.error("[ITR-PLA-001] PDF generation failed:", { message: msg, stack, error: pdfErr });
    const isValidation = msg.includes("maximum of") && msg.includes("rows");
    const userMessage = isValidation
      ? msg
      : "PDF generation failed. If deploying to serverless, ensure puppeteer-core and @sparticuz/chromium are used.";
    return NextResponse.json(
      { error: userMessage },
      { status: isValidation ? 400 : 500 }
    );
  }

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  const subject = isOpenITR
    ? `ITR-PLA-001 — ${section.name} — Open ITR (${pageRecords.length} records)`
    : `ITR-PLA-001 ${safeName} — ITR-${itrIndex}`;
  const text = isOpenITR
    ? `Please find attached the current open ITR report for ${section.name}. This ITR is in progress (${pageRecords.length} of 9 records complete).`
    : `Drainer ITR Report: ${section.name}\nITR-${itrIndex}\n\nPlease find the attached PDF.`;

  const logoAttachment = getLogoAttachment();
  const logoSrc = logoAttachment ? `cid:${LOGO_CID}` : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">ITR-PLA-001 Report</h2>
  <p>Please find the attached ITR report for <strong>${section.name}</strong>${isOpenITR ? ` — Open ITR (${pageRecords.length} of 9 records complete)` : ` — ITR-${itrIndex}`}.</p>
  <p style="color: #666; font-size: 13px;">This report was generated automatically by OnSite-D.</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>
`;

  const attachments: Array<{ filename: string; content: Buffer; contentType?: string; cid?: string }> = [
    { filename: fileName, content: buffer, contentType: "application/pdf" },
  ];
  const logoAtt = getLogoAttachment();
  if (logoAtt) attachments.unshift(logoAtt);

  console.log("[ITR-PLA-001] email route: before sendMail", { recipient, fileName, pdfBufferSize: buffer?.length ?? 0 });
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

    console.log("[ITR-PLA-001] email route: after sendMail");
    return NextResponse.json({ ok: true, message: "Email sent" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[ITR-PLA-001] sendMail failed:", { message: msg, stack, error: err });
    return NextResponse.json(
      { error: "Email failed. PDF was generated but could not be sent." },
      { status: 500 }
    );
  }
}
