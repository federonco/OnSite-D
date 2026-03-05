import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROXIMITY_METERS = 24;

const FALLBACK_ALERT_EMAIL = process.env.ALERT_EMAIL?.trim();

export async function processCheckpointAlerts(
  supabase: SupabaseClient
): Promise<void> {
  const alertFrom = process.env.ALERT_FROM_EMAIL?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (!alertFrom || !resendKey) {
    console.warn("Checkpoint alerts: ALERT_FROM_EMAIL or RESEND_API_KEY not set, skipping");
    return;
  }

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
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: resendKey },
  });

  for (const cp of candidates) {
    const ch = Number(cp.ch);
    const dist = ch - chActual;
    if (dist < 0 || dist > PROXIMITY_METERS) continue;

    const to = (cp.alert_email?.trim() || FALLBACK_ALERT_EMAIL)?.trim();
    if (!to) {
      console.warn(`Checkpoint "${cp.name}" has no alert_email and ALERT_EMAIL not set, skipping`);
      continue;
    }

    try {
      await transporter.sendMail({
        from: alertFrom,
        to,
        subject: `⚠️ Checkpoint próximo: ${cp.name}`,
        text: [
          `Checkpoint: ${cp.name}`,
          `CH del checkpoint: ${ch} m`,
          `CH actual registrado: ${chActual} m`,
          `Distancia restante: ${dist} m`,
        ].join("\n\n"),
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
