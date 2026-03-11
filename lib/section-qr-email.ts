import nodemailer from "nodemailer";
import QRCode from "qrcode";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app";

export async function sendSectionQREmail(params: {
  sectionId: string;
  sectionName: string;
  recipientEmail: string;
}): Promise<void> {
  const { sectionId, sectionName, recipientEmail } = params;
  const pass = process.env.SMTP_PASS?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!pass) {
    console.warn("Section QR email: SMTP_PASS or RESEND_API_KEY not set, skipping");
    return;
  }

  const qrUrl = `${SITE_URL}/?section=${encodeURIComponent(sectionId)}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 280,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const smtpHost = process.env.SMTP_HOST || "smtp.resend.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || "resend";
  const smtpFrom =
    process.env.SMTP_FROM ||
    process.env.ALERT_FROM_EMAIL?.trim() ||
    "Water Cart <info@readx.com.au>";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass },
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Section QR — ${escapeHtml(sectionName)}</title></head>
<body style="font-family: Arial, sans-serif; color: #333; padding: 24px; margin: 0;">
  <h2 style="color: #1a5276;">Section QR Code</h2>
  <p><strong>${escapeHtml(sectionName)}</strong></p>
  <p style="margin: 16px 0;">Scan to open this section in the app:</p>
  <div style="padding: 16px; background: #fff; display: inline-block; border: 1px solid #e0e0e0; border-radius: 8px;">
    <img src="${qrDataUrl}" alt="QR Code for ${escapeHtml(sectionName)}" width="280" height="280" style="display: block;" />
    <p style="margin: 12px 0 0; font-size: 14px; font-weight: bold; text-align: center;">${escapeHtml(sectionName)}</p>
  </div>
  <p style="margin-top: 24px; font-size: 12px; color: #666;">Link: <a href="${qrUrl}">${qrUrl}</a></p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #666;">readX — APA Quality Management Systems</p>
</body>
</html>
`;

  await transporter.sendMail({
    from: smtpFrom,
    to: recipientEmail.trim(),
    subject: `Section QR: ${sectionName}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
