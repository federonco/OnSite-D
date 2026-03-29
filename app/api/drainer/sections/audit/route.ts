import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateAuditReportPdf } from "@/lib/reporting/audit-report-pdf";
import { unwrapProjectsEmbed } from "@/lib/embed-projects";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = getSupabaseServer({ accessToken: token });

  const { data: sectionRow, error: sectionError } = await supabase
    .from("drainer_sections")
    .select("id,name,direction,start_ch,end_ch,projects!project_id(name,number)")
    .eq("id", sectionId)
    .single();

  if (sectionError || !sectionRow) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const section = {
    name: sectionRow.name,
    direction: sectionRow.direction,
    start_ch: sectionRow.start_ch,
    end_ch: sectionRow.end_ch,
    project: unwrapProjectsEmbed(
      (sectionRow as { projects: Parameters<typeof unwrapProjectsEmbed>[0] }).projects
    ),
  };

  const { data: records, error: recordsError } = await supabase
    .from("drainer_pipe_records")
    .select("*")
    .eq("section_id", sectionId)
    .order("date_installed", { ascending: true })
    .order("chainage", { ascending: true });

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }

  const { buffer, contentType, fileName } = await generateAuditReportPdf({
    section,
    records: records ?? [],
    generatedBy: user?.email ?? undefined,
  });

  const pdfBody: BodyInit =
    buffer instanceof Buffer ? new Uint8Array(buffer) : (buffer as unknown as BodyInit);
  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
