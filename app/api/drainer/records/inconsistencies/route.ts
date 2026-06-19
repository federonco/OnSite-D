import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCriteriaForSectionId } from "@/lib/analysis-criteria";
import {
  fetchSectionDirection,
  isSectionBackwards,
  listSectionsForAdminEnumeration,
} from "@/lib/admin-section-enumerator";
import { pipeRecordsSectionOrFilter } from "@/lib/section-catalog";

export type RecordInconsistencyItem = {
  ch_from: number;
  ch_to: number;
  diff: number;
  type: "gap" | "overlap";
  record_from_id: string;
  record_to_id: string;
  record_from_counter: number | null;
  record_from_fitting_id: string;
  record_to_fitting_id: string;
  inferred_type_from: "pipe" | "fitting";
  inferred_type_to: "pipe" | "fitting";
};

export type InconsistenciesResponse = {
  section_id: string;
  section_name?: string;
  total_records: number;
  max_ch: number | null;
  inconsistencies: RecordInconsistencyItem[];
};

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("section_id");
  const subsectionId = searchParams.get("subsection_id");

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
    const result = await getSectionInconsistencies(
      supabase,
      resolvedSectionId,
      subsectionId ?? undefined
    );
    return NextResponse.json(result);
  }

  const sections = await listSectionsForAdminEnumeration(supabase);

  if (!sections.length) {
    return NextResponse.json({ sections: [] });
  }

  const results: InconsistenciesResponse[] = [];
  for (const s of sections) {
    const r = await getSectionInconsistencies(supabase, s.id);
    results.push({ ...r, section_name: s.name });
  }

  return NextResponse.json({ sections: results });
}

async function getSectionInconsistencies(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string,
  subsectionId?: string
): Promise<InconsistenciesResponse> {
  const { criteria } = await getCriteriaForSectionId(supabase, sectionId);
  const pipeRegex = new RegExp(criteria.pipe_id_pattern);
  const direction = await fetchSectionDirection(supabase, sectionId);
  const isBackwards = isSectionBackwards(direction);

  let recordsQuery = supabase
    .from("drainer_pipe_records")
    .select("id,chainage,pipe_fitting_id,counter")
    .or(pipeRecordsSectionOrFilter(sectionId))
    .order("chainage", { ascending: !isBackwards });
  if (subsectionId) {
    recordsQuery = recordsQuery.eq("subsection_id", subsectionId);
  }
  const { data: records, error } = await recordsQuery;

  if (error || !records?.length) {
    return {
      section_id: sectionId,
      total_records: 0,
      max_ch: null,
      inconsistencies: [],
    };
  }

  const maxCh = records.reduce(
    (m, r) => Math.max(m, Number(r.chainage)),
    Number.NEGATIVE_INFINITY
  );
  const ordered = records.map((r) => ({
    id: r.id,
    chainage: Number(r.chainage),
    pipe_fitting_id: r.pipe_fitting_id ?? "",
    counter: r.counter ?? null,
  }));

  const inconsistencies: RecordInconsistencyItem[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const diff = Math.abs(b.chainage - a.chainage);

    if (diff > criteria.gap_threshold_m) {
      inconsistencies.push({
        ch_from: a.chainage,
        ch_to: b.chainage,
        diff,
        type: "gap",
        record_from_id: a.id,
        record_to_id: b.id,
        record_from_counter: a.counter,
        record_from_fitting_id: a.pipe_fitting_id,
        record_to_fitting_id: b.pipe_fitting_id,
        inferred_type_from: pipeRegex.test((a.pipe_fitting_id ?? "").trim()) ? "pipe" : "fitting",
        inferred_type_to: pipeRegex.test((b.pipe_fitting_id ?? "").trim()) ? "pipe" : "fitting",
      });
    } else if (diff < criteria.overlap_threshold_m) {
      inconsistencies.push({
        ch_from: a.chainage,
        ch_to: b.chainage,
        diff,
        type: "overlap",
        record_from_id: a.id,
        record_to_id: b.id,
        record_from_counter: a.counter,
        record_from_fitting_id: a.pipe_fitting_id,
        record_to_fitting_id: b.pipe_fitting_id,
        inferred_type_from: pipeRegex.test((a.pipe_fitting_id ?? "").trim()) ? "pipe" : "fitting",
        inferred_type_to: pipeRegex.test((b.pipe_fitting_id ?? "").trim()) ? "pipe" : "fitting",
      });
    }
  }

  const { data: validated } = await supabase
    .from("drainer_validated_inconsistencies")
    .select("record_from_id, record_to_id")
    .eq("section_id", sectionId);

  const validatedKeys = new Set(
    (validated ?? []).map((v) => `${v.record_from_id}:${v.record_to_id}`)
  );

  const filtered = inconsistencies.filter(
    (inc) => !validatedKeys.has(`${inc.record_from_id}:${inc.record_to_id}`)
  );

  return {
    section_id: sectionId,
    total_records: records.length,
    max_ch: maxCh === Number.NEGATIVE_INFINITY ? null : maxCh,
    inconsistencies: filtered,
  };
}
