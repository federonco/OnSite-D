import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateSectionQRPdf } from "@/lib/reporting/section-qr-pdf";
import { getEmailFrom, getEmailSignatureHtml, getLogoAttachment, LOGO_CID, RESEND_SMTP } from "@/lib/email-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app";

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
    recipientEmail?.trim() || user.email;
  if (!recipient) {
    return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const { data: section, error: sectionError } = await supabase
    .from("drainer_sections")
    .select("id,name")
    .eq("id", sectionId)
    .single();

  if (sectionError || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const qrUrl = `${SITE_URL}/?section=${encodeURIComponent(sectionId)}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  let buffer: Buffer;
  let fileName: string;
  try {
    const result = await generateSectionQRPdf({
      sectionId,
      sectionName: section.name,
      qrDataUrl,
    });
    buffer = result.buffer;
    fileName = result.fileName;
  } catch (err) {
    console.error("QR PDF generation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }

  const pass = process.env.SMTP_PASS?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!pass) {
    return NextResponse.json(
      { error: "SMTP_PASS or RESEND_API_KEY required for email" },
      { status: 500 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: RESEND_SMTP.host,
    port: RESEND_SMTP.port,
    secure: true,
    auth: { user: RESEND_SMTP.user, pass },
  });

  const logoAtt = getLogoAttachment();
  const logoSrc = logoAtt ? `cid:${LOGO_CID}` : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;
  const attachments: Array<{ filename: string; content: Buffer; cid?: string }> = [
    { filename: fileName, content: buffer },
  ];
  if (logoAtt) attachments.unshift(logoAtt);

  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">Section QR Code</h2>
  <p>Attached: QR code for <strong>${section.name}</strong></p>
  <p>Scan to open in the app.</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>`;

  await transporter.sendMail({
    from: getEmailFrom(),
    to: recipient,
    subject: `Section QR: ${section.name}`,
    html: htmlBody,
    attachments,
  });

  return NextResponse.json({ success: true, message: `QR sent to ${recipient}` });
}
