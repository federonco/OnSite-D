import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

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
  hMm: number
): "warning" | "critical" | null {
  const vCritical = vMm >= 45;
  const vWarning = vMm >= 40 && vMm < 45;
  const hCritical = hMm >= 90;
  const hWarning = hMm >= 80 && hMm < 90;
  if (vCritical || hCritical) return "critical";
  if (vWarning || hWarning) return "warning";
  return null;
}

function worstScore(vMm: number, hMm: number): number {
  const vNorm = vMm >= 50 ? 50 : vMm >= 45 ? 45 : vMm >= 40 ? 40 : 0;
  const hNorm = hMm >= 100 ? 100 : hMm >= 90 ? 90 : hMm >= 80 ? 80 : 0;
  return Math.max(vNorm, hNorm / 2);
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("section_id");

  const supabase = getSupabaseServer({ useServiceRole: true });

  if (sectionId) {
    const result = await getNearToleranceForSection(supabase, sectionId);
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
    records: NearToleranceRecord[];
  }[] = [];

  for (const s of sections) {
    const result = await getNearToleranceForSection(supabase, s.id);
    sectionsWithRecords.push({
      section_id: s.id,
      section_name: s.name ?? undefined,
      records: result.records,
    });
  }

  return NextResponse.json({ sections: sectionsWithRecords });
}

async function getNearToleranceForSection(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string
): Promise<{ section_id: string; records: NearToleranceRecord[] }> {
  const { data: records, error } = await supabase
    .from("drainer_pipe_records")
    .select("id,counter,chainage,pipe_fitting_id,deflection_v_sign,deflection_v_mm,deflection_h_side,deflection_h_mm")
    .eq("section_id", sectionId);

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
    const level = getLevel(vMm, hMm);
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
      Math.abs(a.deflection_h_mm ?? 0)
    );
    const scoreB = worstScore(
      Math.abs(b.deflection_v_mm ?? 0),
      Math.abs(b.deflection_h_mm ?? 0)
    );
    return scoreB - scoreA;
  });

  return { section_id: sectionId, records: flagged };
}
