import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCriteriaForSectionId, type AnalysisCriteria } from "@/lib/analysis-criteria";
import {
  listSectionsForAdminEnumeration,
} from "@/lib/admin-section-enumerator";
import { pipeRecordsSectionOrFilter } from "@/lib/section-catalog";

export type NearToleranceRecord = {
  id: string;
  counter: number | null;
  chainage: number;
  pipe_fitting_id: string | null;
  deflection_v_sign: string | null;
  deflection_v_mm: number | null;
  deflection_h_side: string | null;
  deflection_h_mm: number | null;
  level: "warning" | "critical";
};

function getLevel(
  vMm: number,
  hMm: number,
  criteria: AnalysisCriteria
): "warning" | "critical" | null {
  const vCritical = vMm >= criteria.near_tolerance_v_alert;
  const vWarning = vMm >= criteria.near_tolerance_v_warn && vMm < criteria.near_tolerance_v_alert;
  const hCritical = hMm >= criteria.near_tolerance_h_alert;
  const hWarning = hMm >= criteria.near_tolerance_h_warn && hMm < criteria.near_tolerance_h_alert;
  if (vCritical || hCritical) return "critical";
  if (vWarning || hWarning) return "warning";
  return null;
}

function worstScore(vMm: number, hMm: number, criteria: AnalysisCriteria): number {
  const vNorm =
    vMm >= criteria.near_tolerance_v_alert
      ? criteria.near_tolerance_v_alert
      : vMm >= criteria.near_tolerance_v_warn
        ? criteria.near_tolerance_v_warn
        : 0;
  const hNorm =
    hMm >= criteria.near_tolerance_h_alert
      ? criteria.near_tolerance_h_alert
      : hMm >= criteria.near_tolerance_h_warn
        ? criteria.near_tolerance_h_warn
        : 0;
  return Math.max(vNorm, hNorm / 2);
}

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
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
    const result = await getNearToleranceForSection(
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
    records: NearToleranceRecord[];
  }[] = [];

  for (const s of sections) {
    const result = await getNearToleranceForSection(supabase, s.id);
    sectionsWithRecords.push({
      section_id: s.id,
      section_name: s.name,
      records: result.records,
    });
  }

  return NextResponse.json({ sections: sectionsWithRecords });
}

async function getNearToleranceForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string,
  subsectionId?: string
): Promise<{ section_id: string; records: NearToleranceRecord[] }> {
  const { criteria } = await getCriteriaForSectionId(supabase, sectionId);
  let query = supabase
    .from("drainer_pipe_records")
    .select(
      "id,counter,chainage,pipe_fitting_id,deflection_v_sign,deflection_v_mm,deflection_h_side,deflection_h_mm"
    )
    .or(pipeRecordsSectionOrFilter(sectionId));
  if (subsectionId) {
    query = query.eq("subsection_id", subsectionId);
  }
  const { data: records, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const { data: validatedRows } = await supabase
    .from("drainer_validated_near_tolerance")
    .select("record_id");
  const validatedIds = new Set((validatedRows ?? []).map((v) => v.record_id));

  const flagged: NearToleranceRecord[] = [];
  for (const r of records ?? []) {
    if (validatedIds.has(r.id)) continue;
    const vMm = Math.abs(Number(r.deflection_v_mm) ?? 0);
    const hMm = Math.abs(Number(r.deflection_h_mm) ?? 0);
    const level = getLevel(vMm, hMm, criteria);
    if (level) {
      flagged.push({
        id: r.id,
        counter: r.counter ?? null,
        chainage: Number(r.chainage),
        pipe_fitting_id: r.pipe_fitting_id ?? null,
        deflection_v_sign: r.deflection_v_sign ?? null,
        deflection_v_mm: r.deflection_v_mm != null ? Number(r.deflection_v_mm) : null,
        deflection_h_side: r.deflection_h_side ?? null,
        deflection_h_mm: r.deflection_h_mm != null ? Number(r.deflection_h_mm) : null,
        level,
      });
    }
  }

  flagged.sort((a, b) => {
    const scoreA = worstScore(
      Math.abs(a.deflection_v_mm ?? 0),
      Math.abs(a.deflection_h_mm ?? 0),
      criteria
    );
    const scoreB = worstScore(
      Math.abs(b.deflection_v_mm ?? 0),
      Math.abs(b.deflection_h_mm ?? 0),
      criteria
    );
    return scoreB - scoreA;
  });

  return { section_id: sectionId, records: flagged };
}
