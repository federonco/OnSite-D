import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROXIMITY_METERS = 24;

const FALLBACK_ALERT_EMAIL = process.env.ALERT_EMAIL?.trim();

export async function processCheckpointAlerts(
  supabase: SupabaseClient
): Promise<void> {
  const pass =
    process.env.SMTP_PASS?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!pass) {
    console.warn(
      "Checkpoint alerts: SMTP_PASS or RESEND_API_KEY not set, skipping"
    );
    return;
  }
  const smtpHost = process.env.SMTP_HOST || "smtp.resend.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || "resend";
  const smtpFrom =
    process.env.SMTP_FROM ||
    process.env.ALERT_FROM_EMAIL?.trim() ||
    "Water Cart <info@readx.com.au>";

  const { data: maxRow } = await supabase
    .from("drainer_pipe_records")
    .select("chainage")
    .order("chainage", { ascending: false })
    .limit(1)
    .maybeSingle();

  const chActual = maxRow?.chainage != null ? Number(maxRow.chainage) : null;
  if (chActual == null) return;

  const { data: candidates } = await supabase
    .from("checkpoints")
    .select("id,name,ch,alert_email")
    .eq("active", true)
    .eq("notified", false)
    .gte("ch", chActual)
    .lte("ch", chActual + PROXIMITY_METERS);

  if (!candidates?.length) return;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass },
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app";

  for (const cp of candidates) {
    const ch = Number(cp.ch);
    const dist = ch - chActual;
    if (dist < 0 || dist > PROXIMITY_METERS) continue;

    const to = (cp.alert_email?.trim() || FALLBACK_ALERT_EMAIL)?.trim();
    if (!to) {
      console.warn(`Checkpoint "${cp.name}" has no alert_email and ALERT_EMAIL not set, skipping`);
      continue;
    }

    const textBody = [
      `Checkpoint: ${cp.name}`,
      `Checkpoint CH: ${ch} m`,
      `Recorded CH: ${chActual} m`,
      `Remaining distance: ${dist} m`,
    ].join("\n\n");

    const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">⚠️ Checkpoint Approaching</h2>
  <p><strong>${cp.name}</strong></p>
  <p>Checkpoint CH: ${ch} m<br />Recorded CH: ${chActual} m<br />Remaining distance: ${dist} m</p>

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
      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject: `⚠️ Checkpoint approaching: ${cp.name}`,
        text: textBody,
        html: htmlBody,
      });

      await supabase
        .from("checkpoints")
        .update({
          notified: true,
          notified_at: new Date().toISOString(),
        })
        .eq("id", cp.id);
    } catch (err) {
      console.error("Checkpoint alert email failed:", cp.name, err);
    }
  }
}
