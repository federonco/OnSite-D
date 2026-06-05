import type { SupabaseClient } from "@supabase/supabase-js";
import { getCriteriaForDrainerSection } from "@/lib/analysis-criteria";

export type CheckpointPin = {  id: string;
  name: string;
  chainage: number;
  type: string;
  passed: boolean;
};

export type WeldWrapSectionContext = {
  startCh: number | null;
  endCh: number | null;
  direction: string | null;
  backfillUpTo: number | null;
  checkpoints: CheckpointPin[];
};

export function isBackwardsDirection(direction: string | null | undefined): boolean {
  const d = String(direction ?? "").toLowerCase();
  return d === "backward" || d === "backwards";
}

/** Row from `psp_records` (backfill crew), not `drainer_pipe_records` (pipe install). */
export type PspBackfillRecord = {
  chainage: number | null;
  recorded_at?: string | null;
  sign_off_at?: string | null;
};

export function pspRecordTimestamp(record: PspBackfillRecord): number {
  for (const ts of [record.recorded_at, record.sign_off_at]) {
    if (!ts) continue;
    const t = new Date(ts).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

export function findLatestPspRecord(
  records: PspBackfillRecord[]
): PspBackfillRecord | null {
  if (records.length === 0) return null;
  return records.reduce((best, record) =>
    pspRecordTimestamp(record) > pspRecordTimestamp(best) ? record : best
  );
}

function chainageFromPspRecord(record: PspBackfillRecord | null): number | null {
  if (!record || record.chainage == null) return null;
  const ch = Number(record.chainage);
  return Number.isFinite(ch) ? ch : null;
}

/**
 * Backfill front CH from psp_records for the section.
 * Latest activity: recorded_at DESC (fallback sign_off_at).
 * Front edge: MIN(chainage) when backwards, MAX(chainage) when forwards.
 */
export function computeBackfillUpTo(
  records: PspBackfillRecord[],
  direction: string | null | undefined
): number | null {
  if (records.length === 0) return null;

  const chainages = records
    .map((record) => (record.chainage != null ? Number(record.chainage) : NaN))
    .filter((ch) => Number.isFinite(ch));
  if (chainages.length === 0) return null;

  const latestCh = chainageFromPspRecord(findLatestPspRecord(records));
  const frontCh = isBackwardsDirection(direction)
    ? Math.min(...chainages)
    : Math.max(...chainages);

  return frontCh ?? latestCh;
}

/** Resolve drainer_sections.id → sections.id (legacy_id map) and load psp_records. */
export async function fetchPspBackfillRecordsForDrainerSection(
  supabase: SupabaseClient,
  drainerSectionId: string
): Promise<{ records: PspBackfillRecord[]; error?: string }> {
  const { unifiedSectionId } = await getCriteriaForDrainerSection(
    supabase,
    drainerSectionId
  );
  if (!unifiedSectionId) {
    return { records: [] };
  }

  const { data, error } = await supabase
    .from("psp_records")
    .select("chainage,recorded_at,sign_off_at")
    .eq("unified_section_id", unifiedSectionId);

  if (error) {
    return { records: [], error: error.message };
  }

  return { records: (data ?? []) as PspBackfillRecord[] };
}

export function chainageSpanBounds(
  startCh: number | null,
  endCh: number | null
): { min: number; max: number } | null {
  if (startCh == null || endCh == null) return null;
  return { min: Math.min(startCh, endCh), max: Math.max(startCh, endCh) };
}

export function chainageToPercent(
  ch: number,
  startCh: number | null,
  endCh: number | null
): number {
  const bounds = chainageSpanBounds(startCh, endCh);
  if (!bounds) return 0;
  const span = bounds.max - bounds.min || 1;
  return Math.min(100, Math.max(0, ((ch - bounds.min) / span) * 100));
}

export function isCheckpointPassed(
  checkpointCh: number,
  backfillUpTo: number | null,
  direction: string | null | undefined
): boolean {
  if (backfillUpTo == null) return false;
  if (isBackwardsDirection(direction)) {
    return backfillUpTo <= checkpointCh;
  }
  return backfillUpTo >= checkpointCh;
}

export function filterCheckpointsInSpan(
  checkpoints: {
    id: string;
    name: string;
    chainage: number;
    type: string;
    is_active?: boolean | null;
  }[],
  startCh: number | null,
  endCh: number | null,
  backfillUpTo: number | null,
  direction: string | null | undefined
): CheckpointPin[] {
  const bounds = chainageSpanBounds(startCh, endCh);
  if (!bounds) return [];

  return checkpoints
    .filter((cp) => cp.is_active !== false)
    .filter((cp) => cp.chainage >= bounds.min && cp.chainage <= bounds.max)
    .map((cp) => ({
      id: cp.id,
      name: cp.name,
      chainage: cp.chainage,
      type: cp.type,
      passed: isCheckpointPassed(cp.chainage, backfillUpTo, direction),
    }))
    .sort((a, b) => a.chainage - b.chainage);
}

export function findClosestChainageRowIndex(
  rows: { chainage: number | null }[],
  targetCh: number | null
): number | null {
  if (targetCh == null) return null;

  let bestIdx: number | null = null;
  let bestDist = Infinity;
  rows.forEach((row, index) => {
    if (row.chainage == null) return;
    const ch = Number(row.chainage);
    if (!Number.isFinite(ch)) return;
    const dist = Math.abs(ch - targetCh);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = index;
    }
  });
  return bestIdx;
}

export function parseCheckpointChainage(row: Record<string, unknown>): number | null {
  const raw = row.chainage ?? row.ch;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
