import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateSectionQRPdf } from "@/lib/reporting/section-qr-pdf";

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

  const { buffer, fileName } = await generateSectionQRPdf({
    sectionId,
    sectionName: section.name,
    qrDataUrl,
  });

  const pass = process.env.SMTP_PASS?.trim() || process.env.RESEND_API_KEY?.trim();
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

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: recipient,
    subject: `Section QR: ${section.name}`,
    html: `
      <p>Attached: QR code for <strong>${section.name}</strong></p>
      <p>Scan to open in the app.</p>
    `,
    attachments: [
      {
        filename: fileName,
        content: buffer,
      },
    ],
  });

  return NextResponse.json({ success: true, message: `QR sent to ${recipient}` });
}
