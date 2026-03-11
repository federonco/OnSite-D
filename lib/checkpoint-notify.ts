import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailFrom, getEmailSignatureHtml, getLogoAttachment, LOGO_CID, RESEND_SMTP } from "./email-config";

const PROXIMITY_METERS = 30;

const FALLBACK_ALERT_EMAIL = process.env.ALERT_EMAIL?.trim();

export async function processCheckpointAlerts(
  supabase: SupabaseClient,
  sectionId?: string | null
): Promise<void> {
  const pass =
    process.env.SMTP_PASS?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!pass) {
    console.warn(
      "Checkpoint alerts: SMTP_PASS or RESEND_API_KEY not set, skipping"
    );
    return;
  }

  let direction = "onwards";
  if (sectionId) {
    const { data: section } = await supabase
      .from("drainer_sections")
      .select("direction")
      .eq("id", sectionId)
      .single();
    direction = (section?.direction as string) || "onwards";
  }
  const isBackwards = direction === "backwards";

  let chainageQuery = supabase
    .from("drainer_pipe_records")
    .select("chainage");
  if (sectionId) {
    chainageQuery = chainageQuery.eq("section_id", sectionId);
  }
  chainageQuery = chainageQuery.order("chainage", { ascending: isBackwards });
  const { data: frontRow } = await chainageQuery.limit(1).maybeSingle();
  const chFront = frontRow?.chainage != null ? Number(frontRow.chainage) : null;
  if (chFront == null) return;

  let candidates: { id: string; name: string; ch: number; alert_email: string | null }[] = [];

  if (isBackwards) {
    const { data } = await supabase
      .from("checkpoints")
      .select("id,name,ch,alert_email")
      .eq("active", true)
      .eq("notified", false)
      .lt("ch", chFront)
      .gte("ch", chFront - PROXIMITY_METERS);
    candidates = (data ?? []) as { id: string; name: string; ch: number; alert_email: string | null }[];
  } else {
    const { data } = await supabase
      .from("checkpoints")
      .select("id,name,ch,alert_email")
      .eq("active", true)
      .eq("notified", false)
      .gt("ch", chFront)
      .lte("ch", chFront + PROXIMITY_METERS);
    candidates = (data ?? []) as { id: string; name: string; ch: number; alert_email: string | null }[];
  }

  if (!candidates?.length) return;

  const transporter = nodemailer.createTransport({
    host: RESEND_SMTP.host,
    port: RESEND_SMTP.port,
    secure: true,
    auth: { user: RESEND_SMTP.user, pass },
  });

  const logoAttachment = getLogoAttachment();
  const logoSrc = logoAttachment ? `cid:${LOGO_CID}` : `${process.env.NEXT_PUBLIC_SITE_URL || "https://onsite-d.vercel.app"}/readx-logo.png`;

  for (const cp of candidates) {
    const ch = Number(cp.ch);
    const dist = isBackwards ? chFront - ch : ch - chFront;
    if (dist <= 0 || dist > PROXIMITY_METERS) continue;

    const to = (cp.alert_email?.trim() || FALLBACK_ALERT_EMAIL)?.trim();
    if (!to) {
      console.warn(`Checkpoint "${cp.name}" has no alert_email and ALERT_EMAIL not set, skipping`);
      continue;
    }

    const textBody = [
      `Checkpoint: ${cp.name}`,
      `Checkpoint CH: ${ch} m`,
      `Recorded CH: ${chFront} m`,
      `Remaining distance: ${dist} m`,
    ].join("\n\n");

    const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; padding: 24px;">
  <h2 style="color: #1a5276;">⚠️ Checkpoint Approaching</h2>
  <p><strong>${cp.name}</strong></p>
  <p>Checkpoint CH: ${ch} m<br />Recorded CH: ${chFront} m<br />Remaining distance: ${dist} m</p>
  ${getEmailSignatureHtml(logoSrc)}
</div>
`;

    const logoAtt = getLogoAttachment();
    const attachments = logoAtt ? [logoAtt] : [];
    try {
      await transporter.sendMail({
        from: getEmailFrom(),
        to,
        attachments,
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
