import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Pipe: pure digits-hyphen-digits (e.g. 000615-000550, 00615-000255).
 * Fitting: any other (e.g. 90D Bend, Double Scour, 000615-000351 - degree bend Weld Band).
 * Verified against production drainer_pipe_records data.
 */
const PIPE_REGEX = /^\d+-\d+$/;

function inferType(pipeFittingId: string | null): "pipe" | "fitting" {
  if (!pipeFittingId || typeof pipeFittingId !== "string") return "fitting";
  const t = pipeFittingId.trim();
  return PIPE_REGEX.test(t) ? "pipe" : "fitting";
}

export type RecordInconsistencyItem = {
  ch_from: number;
  ch_to: number;
  diff: number;
  type: "gap" | "overlap";
  record_from_id: string;
  record_to_id: string;
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
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("section_id");

  const supabase = getSupabaseServer({ accessToken: token });

  if (sectionId) {
    const result = await getSectionInconsistencies(supabase, sectionId);
    return NextResponse.json(result);
  }

  const { data: sections } = await supabase
    .from("drainer_sections")
    .select("id,name,direction");

  if (!sections?.length) {
    return NextResponse.json({ sections: [] });
  }

  const results: InconsistenciesResponse[] = [];
  for (const s of sections) {
    const r = await getSectionInconsistencies(supabase, s.id);
    results.push({ ...r, section_name: s.name ?? undefined });
  }

  return NextResponse.json({ sections: results });
}

async function getSectionInconsistencies(
  supabase: ReturnType<typeof getSupabaseServer>,
  sectionId: string
): Promise<InconsistenciesResponse> {
  const { data: section } = await supabase
    .from("drainer_sections")
    .select("direction")
    .eq("id", sectionId)
    .single();

  const isBackwards = section?.direction === "backwards";

  const { data: records, error } = await supabase
    .from("drainer_pipe_records")
    .select("id,chainage,pipe_fitting_id")
    .eq("section_id", sectionId)
    .order("chainage", { ascending: !isBackwards });

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
  }));

  const inconsistencies: RecordInconsistencyItem[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const diff = Math.abs(b.chainage - a.chainage);

    if (diff > 13.0) {
      inconsistencies.push({
        ch_from: a.chainage,
        ch_to: b.chainage,
        diff,
        type: "gap",
        record_from_id: a.id,
        record_to_id: b.id,
        record_from_fitting_id: a.pipe_fitting_id,
        record_to_fitting_id: b.pipe_fitting_id,
        inferred_type_from: inferType(a.pipe_fitting_id),
        inferred_type_to: inferType(b.pipe_fitting_id),
      });
    } else if (diff < 12.0) {
      inconsistencies.push({
        ch_from: a.chainage,
        ch_to: b.chainage,
        diff,
        type: "overlap",
        record_from_id: a.id,
        record_to_id: b.id,
        record_from_fitting_id: a.pipe_fitting_id,
        record_to_fitting_id: b.pipe_fitting_id,
        inferred_type_from: inferType(a.pipe_fitting_id),
        inferred_type_to: inferType(b.pipe_fitting_id),
      });
    }
  }

  return {
    section_id: sectionId,
    total_records: records.length,
    max_ch: maxCh === Number.NEGATIVE_INFINITY ? null : maxCh,
    inconsistencies,
  };
}
