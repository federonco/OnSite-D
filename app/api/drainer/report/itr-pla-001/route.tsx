import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateITRPla001Pdf } from "@/lib/reporting/itr-pla-001-pdf";
import { ITR_PAGE_SIZE } from "@/lib/drainer";

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
  const { buffer, contentType, fileName } = await generateITRPla001Pdf(
    section,
    pageRecords,
    itrIndex,
    totalPages
  );

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
