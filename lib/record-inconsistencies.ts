import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CRITERIA, getCriteriaMapForDrainerSections } from "@/lib/analysis-criteria";

export type RecordInconsistency = {
  record_a_ch: number;
  record_b_ch: number;
  difference: number;
  type: "gap" | "overlap";
  section_id?: string;
};

export async function detectRecordInconsistencies(
  supabase: SupabaseClient
): Promise<RecordInconsistency[]> {
  const { data: records, error } = await supabase
    .from("drainer_pipe_records")
    .select("id,chainage,section_id")
    .order("chainage", { ascending: true });

  if (error || !records?.length) return [];

  const bySection = new Map<string, { chainage: number }[]>();
  for (const r of records) {
    const sid = r.section_id ?? "_";
    if (!bySection.has(sid)) bySection.set(sid, []);
    bySection.get(sid)!.push({ chainage: Number(r.chainage) });
  }

  const inconsistencies: RecordInconsistency[] = [];
  const criteriaBySection = await getCriteriaMapForDrainerSections(
    supabase,
    Array.from(bySection.keys()).filter((k) => k !== "_")
  );

  for (const [sectionId, list] of bySection) {
    const criteria =
      sectionId === "_" ? DEFAULT_CRITERIA : (criteriaBySection[sectionId] ?? DEFAULT_CRITERIA);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i].chainage;
      const b = list[i + 1].chainage;
      const diff = b - a;

      if (diff > criteria.gap_threshold_m) {
        inconsistencies.push({
          record_a_ch: a,
          record_b_ch: b,
          difference: diff,
          type: "gap",
          section_id: sectionId === "_" ? undefined : sectionId,
        });
      } else if (diff < criteria.overlap_threshold_m) {
        inconsistencies.push({
          record_a_ch: a,
          record_b_ch: b,
          difference: diff,
          type: "overlap",
          section_id: sectionId === "_" ? undefined : sectionId,
        });
      }
    }
  }

  return inconsistencies;
}
