import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Pipe: digits-hyphen-digits, PP+digits-hyphen-digits, or just digits. */
const PIPE_REGEX = /^((PP)?\d+-\d+|\d+)$/;

function isPipeFormat(pipeFittingId: string | null): boolean {
  if (!pipeFittingId || typeof pipeFittingId !== "string") return false;
  return PIPE_REGEX.test(pipeFittingId.trim());
}

export type DuplicateRecord = {
  id: string;
  counter: number | null;
  chainage: number;
  date_installed: string | null;
};

export type DuplicateGroup = {
  pipe_fitting_id: string;
  count: number;
  records: DuplicateRecord[];
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
    const result = await getDuplicatesForSection(
      supabase,
      resolvedSectionId,
      subsectionId ?? undefined
    );
    return NextResponse.json(result);
  }

  const { data: sections } = await supabase
    .from("drainer_sections")
    .select("id,name");

  if (!sections?.length) {
    return NextResponse.json({ sections: [] });
  }

  const sectionsWithDuplicates: {
    section_id: string;
    section_name?: string;
    duplicates: DuplicateGroup[];
  }[] = [];

  for (const s of sections) {
    const result = await getDuplicatesForSection(supabase, s.id);
    sectionsWithDuplicates.push({
      section_id: s.id,
      section_name: s.name ?? undefined,
      duplicates: result.duplicates,
    });
  }

  return NextResponse.json({ sections: sectionsWithDuplicates });
}

async function getDuplicatesForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string,
  subsectionId?: string
): Promise<{ section_id: string; duplicates: DuplicateGroup[] }> {
  let query = supabase
    .from("drainer_pipe_records")
    .select("id,counter,chainage,date_installed,pipe_fitting_id")
    .eq("section_id", sectionId);
  if (subsectionId) {
    query = query.eq("subsection_id", subsectionId);
  }
  const { data: records, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const byPipeId = new Map<string, { id: string; counter: number | null; chainage: number; date_installed: string | null }[]>();
  for (const r of records ?? []) {
    const pf = r.pipe_fitting_id ?? "";
    if (!isPipeFormat(pf)) continue;
    const list = byPipeId.get(pf) ?? [];
    list.push({
      id: r.id,
      counter: r.counter ?? null,
      chainage: Number(r.chainage),
      date_installed: r.date_installed ?? null,
    });
    byPipeId.set(pf, list);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [pipe_fitting_id, list] of byPipeId) {
    if (list.length > 1) {
      duplicates.push({
        pipe_fitting_id,
        count: list.length,
        records: list.map(({ id, counter, chainage, date_installed }) => ({
          id,
          counter,
          chainage,
          date_installed,
        })),
      });
    }
  }

  return { section_id: sectionId, duplicates };
}
