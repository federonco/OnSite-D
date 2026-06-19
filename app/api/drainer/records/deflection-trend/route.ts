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

export type TrendRecord = {
  counter: number | null;
  chainage: number;
  date_installed: string | null;
  deflection_v_sign: string | null;
  deflection_v_mm: number | null;
  deflection_h_side: string | null;
  deflection_h_mm: number | null;
};

export type DeflectionTrendEntry = {
  type: "vertical" | "horizontal";
  direction: string;
  records: TrendRecord[];
  avg_mm: number;
  first_record_id?: string;
  first_record_counter?: number | null;
};

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
    const result = await getDeflectionTrendForSection(
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

  const sectionsWithTrends: {
    section_id: string;
    section_name?: string;
    trends: DeflectionTrendEntry[];
  }[] = [];

  for (const s of sections) {
    const result = await getDeflectionTrendForSection(supabase, s.id);
    sectionsWithTrends.push({
      section_id: s.id,
      section_name: s.name,
      trends: result.trends,
    });
  }

  return NextResponse.json({ sections: sectionsWithTrends });
}

async function getDeflectionTrendForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string,
  subsectionId?: string
): Promise<{ section_id: string; trends: DeflectionTrendEntry[] }> {
  const { criteria } = await getCriteriaForSectionId(supabase, sectionId);
  const direction = await fetchSectionDirection(supabase, sectionId);
  const ascending = !isSectionBackwards(direction);

  let query = supabase
    .from("drainer_pipe_records")
    .select(
      "id,counter,chainage,date_installed,deflection_v_sign,deflection_v_mm,deflection_h_side,deflection_h_mm"
    )
    .or(pipeRecordsSectionOrFilter(sectionId))
    .order("chainage", { ascending });
  if (subsectionId) {
    query = query.eq("subsection_id", subsectionId);
  }
  const { data: records, error } = await query;

  if (error || !records?.length) {
    return { section_id: sectionId, trends: [] };
  }

  const ordered = records.map((r) => ({
    id: r.id,
    counter: r.counter ?? null,
    chainage: Number(r.chainage),
    date_installed: r.date_installed ?? null,
    deflection_v_sign: r.deflection_v_sign ?? null,
    deflection_v_mm: r.deflection_v_mm != null ? Number(r.deflection_v_mm) : null,
    deflection_h_side: r.deflection_h_side ?? null,
    deflection_h_mm: r.deflection_h_mm != null ? Number(r.deflection_h_mm) : null,
  }));

  const trends: DeflectionTrendEntry[] = [];
  const windowSize = Math.max(2, Math.floor(criteria.deflection_trend_window));

  for (let i = 0; i <= ordered.length - windowSize; i++) {
    const window = ordered.slice(i, i + windowSize);

    const vSigns = window.map((r) => (r.deflection_v_sign ?? "").trim()).filter(Boolean);
    const vMms = window.map((r) => Math.abs(r.deflection_v_mm ?? 0));
    const allVSameSign = vSigns.length === windowSize && new Set(vSigns).size === 1;
    const allVAbove15 = vMms.every((m) => m >= criteria.deflection_trend_v_threshold);
    if (allVSameSign && allVAbove15) {
      const direction = vSigns[0] === "+" ? "positive (+)" : "negative (−)";
      const avg = vMms.reduce((a, b) => a + b, 0) / windowSize;
      trends.push({
        type: "vertical",
        direction,
        records: window.map(({ id: _id, ...rest }) => rest),
        avg_mm: Math.round(avg * 10) / 10,
        first_record_id: window[0].id,
        first_record_counter: window[0].counter,
      });
    }

    const hSides = window.map((r) => (r.deflection_h_side ?? "").trim()).filter(Boolean);
    const hMms = window.map((r) => Math.abs(r.deflection_h_mm ?? 0));
    const allHSameSide = hSides.length === windowSize && new Set(hSides).size === 1;
    const allHAbove20 = hMms.every((m) => m >= criteria.deflection_trend_h_threshold);
    if (allHSameSide && allHAbove20) {
      const direction = hSides[0] === "L" ? "Left (L)" : "Right (R)";
      const avg = hMms.reduce((a, b) => a + b, 0) / windowSize;
      trends.push({
        type: "horizontal",
        direction,
        records: window.map(({ id: _id, ...rest }) => rest),
        avg_mm: Math.round(avg * 10) / 10,
        first_record_id: window[0].id,
        first_record_counter: window[0].counter,
      });
    }
  }

  return { section_id: sectionId, trends };
}
