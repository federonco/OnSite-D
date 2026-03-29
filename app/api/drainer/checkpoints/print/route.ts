import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateCheckpointRecordPdf } from "@/lib/reporting/checkpoint-record-pdf";
import { fetchCheckpointPrintSectionById } from "@/lib/drainer-sections-read";

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const sectionId = body.section_id ?? null;

  const supabase = getSupabaseServer({ useServiceRole: true });

  let section: {
    name: string;
    project: { name: string | null; number: string | null } | null;
  };
  let history: Array<{
    id: string;
    name: string;
    chainage: number;
    type: string;
    alert_email: string | null;
    last_notified: string;
    expired_at: string;
  }>;

  if (sectionId) {
    const { section: sec, error: sectionErr } = await fetchCheckpointPrintSectionById(
      supabase,
      sectionId
    );
    if (!sec) {
      return NextResponse.json(
        { error: sectionErr?.message ?? "Section not found" },
        { status: 404 }
      );
    }
    section = sec;

    const { data: historyData, error: historyError } = await supabase
      .from("checkpoint_history")
      .select("id,name,chainage,type,alert_email,last_notified,expired_at")
      .eq("section_id", sectionId)
      .order("expired_at", { ascending: false });

    if (historyError) {
      return NextResponse.json(
        { error: historyError.message },
        { status: 500 }
      );
    }
    history = historyData ?? [];
  } else {
    section = {
      name: "All Sections",
      project: null,
    };

    const { data: historyData, error: historyError } = await supabase
      .from("checkpoint_history")
      .select("id,name,chainage,type,alert_email,last_notified,expired_at")
      .order("expired_at", { ascending: false });

    if (historyError) {
      return NextResponse.json(
        { error: historyError.message },
        { status: 500 }
      );
    }
    history = historyData ?? [];
  }

  const datePrinted = new Date().toISOString();
  const { buffer, contentType, fileName } = await generateCheckpointRecordPdf(
    section,
    history,
    datePrinted
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
