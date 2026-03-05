import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordInconsistency = {
  record_a_ch: number;
  record_b_ch: number;
  difference: number;
  type: "gap" | "overlap";
  section_id?: string;
};

const MIN_DIFF = 12;
const MAX_DIFF = 13;

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

  for (const [sectionId, list] of bySection) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i].chainage;
      const b = list[i + 1].chainage;
      const diff = b - a;

      if (diff > MAX_DIFF) {
        inconsistencies.push({
          record_a_ch: a,
          record_b_ch: b,
          difference: diff,
          type: "gap",
          section_id: sectionId === "_" ? undefined : sectionId,
        });
      } else if (diff < MIN_DIFF) {
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
