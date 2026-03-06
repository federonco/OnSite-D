import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export type TrendRecord = {
  counter: number | null;
  chainage: number;
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
  const { user } = await getUserFromRequest(request);
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("section_id");

  const supabase = getSupabaseServer({ useServiceRole: true });

  if (sectionId) {
    const result = await getDeflectionTrendForSection(supabase, sectionId);
    return NextResponse.json(result);
  }

  const { data: sections } = await supabase
    .from("drainer_sections")
    .select("id,name");

  if (!sections?.length) {
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
      section_name: s.name ?? undefined,
      trends: result.trends,
    });
  }

  return NextResponse.json({ sections: sectionsWithTrends });
}

async function getDeflectionTrendForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string
): Promise<{ section_id: string; trends: DeflectionTrendEntry[] }> {
  const { data: section } = await supabase
    .from("drainer_sections")
    .select("direction")
    .eq("id", sectionId)
    .single();

  const ascending = section?.direction !== "backwards";

  const { data: records, error } = await supabase
    .from("drainer_pipe_records")
    .select("id,counter,chainage,deflection_v_sign,deflection_v_mm,deflection_h_side,deflection_h_mm")
    .eq("section_id", sectionId)
    .order("chainage", { ascending });

  if (error || !records?.length) {
    return { section_id: sectionId, trends: [] };
  }

  const ordered = records.map((r) => ({
    id: r.id,
    counter: r.counter ?? null,
    chainage: Number(r.chainage),
    deflection_v_sign: r.deflection_v_sign ?? null,
    deflection_v_mm: r.deflection_v_mm != null ? Number(r.deflection_v_mm) : null,
    deflection_h_side: r.deflection_h_side ?? null,
    deflection_h_mm: r.deflection_h_mm != null ? Number(r.deflection_h_mm) : null,
  }));

  const trends: DeflectionTrendEntry[] = [];
  const windowSize = 4;

  for (let i = 0; i <= ordered.length - windowSize; i++) {
    const window = ordered.slice(i, i + windowSize);

    const vSigns = window.map((r) => (r.deflection_v_sign ?? "").trim()).filter(Boolean);
    const vMms = window.map((r) => Math.abs(r.deflection_v_mm ?? 0));
    const allVSameSign = vSigns.length === windowSize && new Set(vSigns).size === 1;
    const allVAbove15 = vMms.every((m) => m >= 15);
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
    const allHAbove20 = hMms.every((m) => m >= 20);
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
