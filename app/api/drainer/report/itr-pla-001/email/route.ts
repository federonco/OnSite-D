import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateITRPla001Pdf } from "@/lib/reporting/itr-pla-001-pdf";
import { ITR_PAGE_SIZE } from "@/lib/drainer";

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

  const totalPages = Math.ceil(records.length / ITR_PAGE_SIZE);
  const isOpenITR = pageRecords.length < ITR_PAGE_SIZE;
  const { buffer, fileName } = await generateITRPla001Pdf(
    section,
    pageRecords,
    itrIndex,
    totalPages,
    { isOpenITR }
  );

  const pass =
    process.env.SMTP_PASS?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!pass) {
    return NextResponse.json(
      { error: "SMTP_PASS or RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.resend.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || "resend";
  const smtpFrom =
    process.env.SMTP_FROM ||
    process.env.ALERT_FROM_EMAIL?.trim() ||
    "Water Cart <info@readx.com.au>";

  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  const subject = isOpenITR
    ? `ITR-PLA-001 — ${section.name} — Open ITR (${pageRecords.length} records)`
    : `ITR-PLA-001 ${safeName} — ITR-${itrIndex}`;
  const text = isOpenITR
    ? `Please find attached the current open ITR report for ${section.name}. This ITR is in progress (${pageRecords.length} of 9 records complete).`
    : `Drainer ITR Report: ${section.name}\nITR-${itrIndex}\n\nPlease find the attached PDF.`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app";
  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">ITR-PLA-001 Report</h2>
  <p>Please find the attached ITR report for <strong>${section.name}</strong>${isOpenITR ? ` — Open ITR (${pageRecords.length} of 9 records complete)` : ` — ITR-${itrIndex}`}.</p>
  <p style="color: #666; font-size: 13px;">This report was generated automatically by OnSite-D.</p>

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;" />

  <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif;">
    <tr>
      <td style="padding-right: 16px; vertical-align: middle;">
        <a href="https://www.readx.com.au" target="_blank" style="display:block;">
          <img src="${siteUrl}/readx-logo.png" alt="readX" width="80" style="display:block;" />
        </a>
      </td>
      <td style="vertical-align: middle; border-left: 2px solid #1a5276; padding-left: 16px;">
        <p style="margin:0; font-size: 15px; font-weight: bold; color: #1a5276;">readX Team</p>
        <p style="margin:4px 0 0; font-size: 13px; color: #555;">Drainer - OnSite-D</p>
        <p style="margin:4px 0 0; font-size: 12px;">
          <a href="https://www.readx.com.au" target="_blank"
             style="color: #1a5276; text-decoration: none;">www.readX.com.au</a>
        </p>
      </td>
    </tr>
  </table>
</div>
`;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true,
      auth: { user: smtpUser, pass },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: recipient,
      subject,
      text,
      html: htmlBody,
      attachments: [
        {
          filename: fileName,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({ ok: true, message: "Email sent" });
  } catch (err) {
    console.error("ITR email failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Email failed" },
      { status: 500 }
    );
  }
}
