import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Pipe format: digits-hyphen-digits, PP+digits-hyphen-digits, or just digits. Fitting: anything else. */
const PIPE_REGEX = /^((PP)?\d+-\d+|\d+)$/;

export type FittingRecord = {
  id: string;
  counter: number | null;
  chainage: number;
  pipe_fitting_id: string | null;
  date_installed: string | null;
};

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("section_id");
  const subsectionId = searchParams.get("subsection_id");

  const supabase = getSupabaseServer({ useServiceRole: true });

  let resolvedSectionId = sectionId;
  if (!resolvedSectionId && subsectionId) {
    const { data: subsection } = await supabase
      .from("subsections")
      .select("section_id")
      .eq("id", subsectionId)
      .maybeSingle();
    resolvedSectionId = subsection?.section_id ?? null;
  }

  if (resolvedSectionId) {
    const result = await getFittingsForSection(supabase, resolvedSectionId, subsectionId ?? undefined);
    return NextResponse.json(result);
  }

  const { data: sections } = await supabase
    .from("drainer_sections")
    .select("id,name");

  if (!sections?.length) {
    return NextResponse.json({ sections: [] });
  }

  const sectionsWithRecords: {
    section_id: string;
    section_name?: string;
    records: FittingRecord[];
  }[] = [];

  for (const s of sections) {
    const result = await getFittingsForSection(supabase, s.id);
    sectionsWithRecords.push({
      section_id: s.id,
      section_name: s.name ?? undefined,
      records: result.records,
    });
  }

  return NextResponse.json({ sections: sectionsWithRecords });
}

async function getFittingsForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string,
  subsectionId?: string
): Promise<{ section_id: string; records: FittingRecord[] }> {
  let query = supabase
    .from("drainer_pipe_records")
    .select("id,counter,chainage,pipe_fitting_id,date_installed")
    .eq("section_id", sectionId);
  if (subsectionId) {
    query = query.eq("subsection_id", subsectionId);
  }
  const { data: records, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const { data: validatedRows } = await supabase
    .from("drainer_validated_fittings")
    .select("record_id");
  const validatedIds = new Set((validatedRows ?? []).map((v) => v.record_id));

  const fittings: FittingRecord[] = [];
  for (const r of records ?? []) {
    if (validatedIds.has(r.id)) continue;
    const pf = (r.pipe_fitting_id ?? "").trim();
    if (!pf) continue;
    if (PIPE_REGEX.test(pf)) continue; // pipe format, skip
    fittings.push({
      id: r.id,
      counter: r.counter ?? null,
      chainage: Number(r.chainage),
      pipe_fitting_id: r.pipe_fitting_id ?? null,
      date_installed: r.date_installed ?? null,
    });
  }

  fittings.sort((a, b) => a.chainage - b.chainage);

  return { section_id: sectionId, records: fittings };
}
