import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import {
  createEmailTransporter,
  getEmailFrom,
  getEmailSignatureHtml,
  getLogoAttachment,
  hasEmailConfig,
  LOGO_CID,
} from "@/lib/email-config";
import { generateSectionQrPdf } from "@/lib/reporting/section-qr-pdf";
import { buildEnterUrlFromQrToken } from "@/lib/site-url";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeAttachmentBaseName(name: string): string {
  const s = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .trim()
    .replace(/\s+/g, "-");
  return s || "Section";
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const {
    sectionId,
    email: emailBody,
    recipientEmail: legacyRecipient,
    token: clientQrToken,
  } = body as {
    sectionId?: string;
    email?: string;
    recipientEmail?: string;
    token?: string | null;
    url?: string;
  };

  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const recipient =
    (typeof emailBody === "string" ? emailBody.trim() : "") ||
    (typeof legacyRecipient === "string" ? legacyRecipient.trim() : "") ||
    process.env.REPORT_DEFAULT_EMAIL?.trim() ||
    user.email?.trim() ||
    "";
  if (!recipient) {
    return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ accessToken: token });

  const { data: section, error: sectionError } = await supabase
    .from("drainer_sections")
    .select("id,name,qr_token,qr_token_issued_at")
    .eq("id", sectionId)
    .single();

  if (sectionError || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  let qrToken = section.qr_token as string | null;

  if (!qrToken) {
    qrToken = crypto.randomUUID();
    const issued = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("drainer_sections")
      .update({
        qr_token: qrToken,
        qr_token_issued_at: issued,
      })
      .eq("id", sectionId);
    if (upErr) {
      console.error("[send-qr] persist token failed:", upErr.message);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  if (
    clientQrToken != null &&
    typeof clientQrToken === "string" &&
    clientQrToken !== qrToken
  ) {
    return NextResponse.json(
      { error: "QR token mismatch. Refresh and try again." },
      { status: 400 }
    );
  }

  const enterUrl = buildEnterUrlFromQrToken(qrToken);
  const sectionName = String(section.name ?? "Section");

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateSectionQrPdf(sectionName, enterUrl);
  } catch (err) {
    console.error("[send-qr] generateSectionQrPdf failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://onsite-d.vercel.app";
  const logoAtt = getLogoAttachment();
  const logoSrc = logoAtt ? `cid:${LOGO_CID}` : `${siteUrl}/readx-logo.png`;

  const pdfBase = safeAttachmentBaseName(sectionName);
  const pdfFilename = `QR-${pdfBase}.pdf`;

  const attachments: Array<{
    filename: string;
    content: Buffer;
    cid?: string;
    contentType?: string;
  }> = [];
  if (logoAtt) attachments.push(logoAtt);
  attachments.push({
    filename: pdfFilename,
    content: pdfBuffer,
    contentType: "application/pdf",
  });

  const subject = `QR Code — ${sectionName}`;
  const textBody = `Please find the QR code for ${sectionName} attached.\n`;
  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <p>Please find the QR code for <strong>${escapeHtml(sectionName)}</strong> attached.</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>
`;

  try {
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: getEmailFrom(),
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({
      success: true,
      message: `QR sent to ${recipient}`,
    });
  } catch (err) {
    console.error("Send QR email failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Email failed" },
      { status: 500 }
    );
  }
}
