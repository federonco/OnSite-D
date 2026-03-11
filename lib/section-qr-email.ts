import QRCode from "qrcode";
import { createEmailTransporter, getEmailFrom, getEmailSignatureHtml, getLogoAttachment, hasEmailConfig, LOGO_CID } from "./email-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app";

export async function sendSectionQREmail(params: {
  sectionId: string;
  sectionName: string;
  recipientEmail: string;
}): Promise<void> {
  const { sectionId, sectionName, recipientEmail } = params;
  if (!hasEmailConfig()) {
    console.warn("Section QR email: RESEND_API_KEY not set, skipping");
    return;
  }

  const qrUrl = `${SITE_URL}/?section=${encodeURIComponent(sectionId)}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 280,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const transporter = createEmailTransporter();

  const logoAtt = getLogoAttachment();
  const logoSrc = logoAtt ? `cid:${LOGO_CID}` : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;
  const attachments = logoAtt ? [logoAtt] : [];

  const htmlWithSig = `
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
  ${getEmailSignatureHtml(logoSrc)}
</body>
</html>
`;

  await transporter.sendMail({
    from: getEmailFrom(),
    to: recipientEmail.trim(),
    subject: `Section QR: ${sectionName}`,
    html: htmlWithSig,
    attachments,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
