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
  const { sectionId, itrIndex } = body;

  if (!sectionId || !itrIndex || typeof itrIndex !== "number") {
    return NextResponse.json(
      { error: "Missing sectionId or itrIndex" },
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
  const { buffer, fileName } = await generateITRPla001Pdf(
    section,
    pageRecords,
    itrIndex,
    totalPages
  );

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    return NextResponse.json(
      { error: "SMTP not configured" },
      { status: 500 }
    );
  }

  const recipient = user.email;
  const safeName = (section.name ?? "section").replace(/\s+/g, "-");

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number.parseInt(smtpPort, 10),
      secure: Number.parseInt(smtpPort, 10) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: recipient,
      subject: `ITR-PLA-001 ${safeName} — ITR-${itrIndex}`,
      text: `Drainer ITR Report: ${section.name}\nITR-${itrIndex}\n\nPlease find the attached PDF.`,
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
