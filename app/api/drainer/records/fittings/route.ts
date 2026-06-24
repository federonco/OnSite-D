import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCriteriaForSectionId } from "@/lib/analysis-criteria";
import { listSectionsForAdminEnumeration } from "@/lib/admin-section-enumerator";
import { pipeRecordsSectionOrFilter } from "@/lib/section-catalog";
import { buildGuideFittingValidation } from "@/lib/guide-record-matching";
import {
  fetchSectionGuideConfig,
  recordMatchesJointTypes,
} from "@/lib/section-app-config";

export type FittingRecord = {
  id: string;
  counter: number | null;
  chainage: number;
  pipe_fitting_id: string | null;
  date_installed: string | null;
};

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(getSupabaseServer({ accessToken: token })))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("section_id");
  const subsectionId = searchParams.get("subsection_id");

  const supabase = getSupabaseServer({ accessToken: token });

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
    const result = await getFittingsForSection(
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

  const sectionsWithRecords: {
    section_id: string;
    section_name?: string;
    records: FittingRecord[];
    guide_validation?: ReturnType<typeof buildGuideFittingValidation>;
    not_laid?: { sequence_number: number; item_id: string }[];
  }[] = [];

  for (const s of sections) {
    const result = await getFittingsForSection(supabase, s.id);
    sectionsWithRecords.push({
      section_id: s.id,
      section_name: s.name,
      records: result.records,
      guide_validation: result.guide_validation ?? undefined,
      not_laid: result.not_laid,
    });
  }

  return NextResponse.json({ sections: sectionsWithRecords });
}

async function getFittingsForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string,
  subsectionId?: string
): Promise<{
  section_id: string;
  records: FittingRecord[];
  guide_validation?: ReturnType<typeof buildGuideFittingValidation>;
  not_laid?: { sequence_number: number; item_id: string }[];
}> {
  const guideConfig = await fetchSectionGuideConfig(supabase, sectionId);
  const guideMode = guideConfig?.guideMode === true;

  if (guideMode && guideConfig?.guide_xml) {
    const { unifiedSectionId } = await getCriteriaForSectionId(supabase, sectionId);
    const catalogId = unifiedSectionId ?? sectionId;

    let query = supabase
      .from("drainer_pipe_records")
      .select(
        "id,counter,chainage,pipe_fitting_id,date_installed,joint_type,welded_at,wrapped_at"
      )
      .eq("unified_section_id", catalogId);
    if (subsectionId) {
      query = query.eq("subsection_id", subsectionId);
    }
    const { data: records, error } = await query;
    if (error) throw new Error(error.message);

    const jointTypes = guideConfig.joint_types;
    const scoped = (records ?? []).filter((r) =>
      recordMatchesJointTypes(r.joint_type, jointTypes)
    );

    const guideValidation = buildGuideFittingValidation(
      guideConfig.guide_xml,
      true,
      scoped.map((r) => ({
        ...r,
        id: r.id,
        chainage: Number(r.chainage),
      }))
    );

    const { data: validatedRows } = await supabase
      .from("drainer_validated_fittings")
      .select("record_id");
    const validatedIds = new Set((validatedRows ?? []).map((v) => v.record_id));

    const offGuideRecords: FittingRecord[] = (guideValidation?.off_guide ?? [])
      .filter((r) => !validatedIds.has(r.id))
      .map((r) => ({
        id: r.id,
        counter: r.counter,
        chainage: r.chainage,
        pipe_fitting_id: r.pipe_fitting_id,
        date_installed: r.date_installed,
      }));

    return {
      section_id: sectionId,
      records: offGuideRecords,
      guide_validation: guideValidation ?? undefined,
      not_laid: guideValidation?.not_laid,
    };
  }

  const { criteria } = await getCriteriaForSectionId(supabase, sectionId);
  let pipeRegex: RegExp;
  try {
    pipeRegex = new RegExp(criteria.pipe_id_pattern);
  } catch {
    pipeRegex = /^\d+-\d+$/;
  }

  let query = supabase
    .from("drainer_pipe_records")
    .select("id,counter,chainage,pipe_fitting_id,date_installed")
    .or(pipeRecordsSectionOrFilter(sectionId));
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
    if (pipeRegex.test(pf)) continue;
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
