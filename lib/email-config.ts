import { readFileSync } from "fs";
import { join } from "path";
import nodemailer from "nodemailer";

/** Default from address for all emails (Resend). Requires readx.com.au verified in Resend dashboard. */
export const EMAIL_FROM_DEFAULT = "OnSite-D <info@readx.com.au>";

/** Resend SMTP config - hardcoded to avoid Gmail override via env */
export const RESEND_SMTP = {
  host: "smtp.resend.com",
  port: 465,
  user: "resend",
};

/** Creates nodemailer transporter for Resend SMTP. Requires RESEND_API_KEY. */
export function createEmailTransporter() {
  const pass = process.env.RESEND_API_KEY?.trim();
  if (!pass) {
    throw new Error("RESEND_API_KEY required for email");
  }
  return nodemailer.createTransport({
    host: RESEND_SMTP.host,
    port: RESEND_SMTP.port,
    secure: true,
    auth: { user: RESEND_SMTP.user, pass },
  });
}

/** Returns true if email can be sent (RESEND_API_KEY set and not placeholder). */
export function hasEmailConfig(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  if (key === "..." || key.length < 10) return false;
  return true;
}

/** From address for outgoing emails. Priority: RESEND_FROM > SMTP_FROM > ALERT_FROM_EMAIL > default */
export function getEmailFrom(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.ALERT_FROM_EMAIL?.trim() ||
    EMAIL_FROM_DEFAULT
  );
}

export const LOGO_CID = "readx-logo@onsite-d";

/** Inline logo attachment for HTML emails. Use img src="cid:readx-logo@onsite-d" */
export function getLogoAttachment(): { filename: string; content: Buffer; cid: string } | null {
  try {
    const logoPath = join(process.cwd(), "public", "readx-logo.png");
    const content = readFileSync(logoPath);
    return {
      filename: "readx-logo.png",
      content,
      cid: LOGO_CID,
    };
  } catch {
    return null;
  }
}

/** Shared email signature HTML (logo + readX Team). Pass logoSrc from getLogoImgSrc(). */
export function getEmailSignatureHtml(logoSrc: string): string {
  return `
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;" />
  <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif;">
    <tr>
      <td style="padding-right: 16px; vertical-align: middle;">
        <a href="https://www.readx.com.au" target="_blank" style="display:block;">
          <img src="${logoSrc}" alt="readX" width="80" style="display:block;" />
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
  </table>`;
}

