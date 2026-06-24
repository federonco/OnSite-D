import type { GuideItem } from "@/lib/installation-guide-xml";

export const WB_WELD_STEPS = [
  "external_1",
  "external_2",
  "internal_1",
  "internal_2",
] as const;

export type WwRecordFields = {
  joint_type: string | null;
  welded_at: string | null;
  wrapped_at: string | null;
  welded_steps?: Record<string, string | null> | null;
  pipe_fitting_id?: string | null;
  chainage?: number | null;
};

export type WwCompletionStatus = "done" | "laid_ww_pending";
export type GuideRowStatus = WwCompletionStatus | "not_laid" | "off_guide";

export type WwPendingDetail = {
  weld: boolean;
  wrap: boolean;
};

/** Uppercase; strip everything except [A-Z0-9]. */
export function normalizeGuideToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Best guide item for a pipe_fitting_id (longest item_id, then lowest sequence_number). */
export function findBestGuideMatch(
  pipeFittingId: string | null | undefined,
  guide: GuideItem[]
): GuideItem | null {
  const normalizedPipe = normalizeGuideToken(pipeFittingId ?? "");
  if (!normalizedPipe || guide.length === 0) return null;

  const candidates = guide.filter((item) => {
    const token = normalizeGuideToken(item.item_id);
    return token.length > 0 && normalizedPipe.includes(token);
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const lenDiff =
      normalizeGuideToken(b.item_id).length - normalizeGuideToken(a.item_id).length;
    if (lenDiff !== 0) return lenDiff;
    return a.sequence_number - b.sequence_number;
  });
  return candidates[0] ?? null;
}

export function isRecordWelded(record: WwRecordFields): boolean {
  if (record.joint_type === "RRJ") return true;
  if (record.joint_type === "WB") {
    const steps = record.welded_steps ?? {};
    return WB_WELD_STEPS.every((step) => !!steps[step]);
  }
  return record.welded_at != null;
}

function maxIsoTimestamp(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, ts) => {
    const t = new Date(ts).getTime();
    const lt = new Date(latest).getTime();
    if (Number.isNaN(t)) return latest;
    if (Number.isNaN(lt)) return ts;
    return t > lt ? ts : latest;
  });
}

/** Display weld completion date — aligns with isRecordWelded (WB uses latest step when welded_at is null). */
export function getWeldCompletionDate(record: WwRecordFields): string | null {
  if (record.joint_type === "WB") {
    if (!isRecordWelded(record)) return null;
    if (record.welded_at) return record.welded_at;
    const steps = record.welded_steps ?? {};
    const stepTimes = WB_WELD_STEPS.map((step) => steps[step]).filter(
      (ts): ts is string => typeof ts === "string" && ts.length > 0
    );
    return maxIsoTimestamp(stepTimes);
  }
  return record.welded_at;
}

export function computeWwCompletionStatus(record: WwRecordFields): WwCompletionStatus {
  if (record.joint_type === "RRJ") return "done";
  if (isRecordWelded(record) && record.wrapped_at != null) return "done";
  return "laid_ww_pending";
}

export function wwPendingDetail(record: WwRecordFields): WwPendingDetail {
  const welded = isRecordWelded(record);
  const wrapped = record.wrapped_at != null;
  return { weld: !welded, wrap: !wrapped };
}

export function formatWwPendingDetail(detail: WwPendingDetail): string {
  if (detail.weld && detail.wrap) return "Weld & wrap pending";
  if (detail.weld) return "Weld pending";
  if (detail.wrap) return "Wrap pending";
  return "";
}

export type GuideDisplayRow<T extends WwRecordFields = WwRecordFields> = {
  kind: "guide_record" | "not_laid" | "off_guide";
  sequence_number: number | null;
  item_id: string | null;
  expected_joint_type?: string | null;
  record: T | null;
  status: GuideRowStatus;
  pendingDetail: WwPendingDetail | null;
};

export function formatGuideNotLaidStatus(
  itemId: string | null | undefined,
  jointType?: string | null
): string {
  const id = itemId?.trim();
  const jt = jointType?.trim();
  if (id && jt) return `${id} — ${jt} — Not laid`;
  return "Not laid";
}

function chainageSortValue(record: WwRecordFields): number {
  const ch = Number(record.chainage);
  return Number.isFinite(ch) ? ch : Infinity;
}

/**
 * Guide order by sequence_number; multiple records per item; off-guide at end.
 */
export function buildGuideDisplayRows<T extends WwRecordFields>(
  guide: GuideItem[],
  records: T[]
): GuideDisplayRow<T>[] {
  const sortedGuide = [...guide].sort((a, b) => a.sequence_number - b.sequence_number);
  const recordsBySequence = new Map<number, T[]>();
  const offGuide: T[] = [];

  for (const record of records) {
    const match = findBestGuideMatch(record.pipe_fitting_id, sortedGuide);
    if (!match) {
      offGuide.push(record);
      continue;
    }
    const bucket = recordsBySequence.get(match.sequence_number) ?? [];
    bucket.push(record);
    recordsBySequence.set(match.sequence_number, bucket);
  }

  const rows: GuideDisplayRow<T>[] = [];

  for (const item of sortedGuide) {
    const matched = (recordsBySequence.get(item.sequence_number) ?? []).sort(
      (a, b) => chainageSortValue(a) - chainageSortValue(b)
    );
    if (matched.length === 0) {
      rows.push({
        kind: "not_laid",
        sequence_number: item.sequence_number,
        item_id: item.item_id,
        expected_joint_type: item.joint_type ?? null,
        record: null,
        status: "not_laid",
        pendingDetail: null,
      });
      continue;
    }
    for (const record of matched) {
      const completion = computeWwCompletionStatus(record);
      rows.push({
        kind: "guide_record",
        sequence_number: item.sequence_number,
        item_id: item.item_id,
        expected_joint_type: item.joint_type ?? null,
        record,
        status: completion,
        pendingDetail: completion === "laid_ww_pending" ? wwPendingDetail(record) : null,
      });
    }
  }

  offGuide
    .sort((a, b) => chainageSortValue(a) - chainageSortValue(b))
    .forEach((record) => {
      const completion = computeWwCompletionStatus(record);
      rows.push({
        kind: "off_guide",
        sequence_number: null,
        item_id: null,
        record,
        status: "off_guide",
        pendingDetail: completion === "laid_ww_pending" ? wwPendingDetail(record) : null,
      });
    });

  return rows;
}

export type GuideFittingValidation = {
  guide_enabled: boolean;
  matched_valid: Array<{
    record_id: string;
    item_id: string;
    sequence_number: number;
    pipe_fitting_id: string | null;
    chainage: number;
    counter: number | null;
  }>;
  off_guide: Array<{
    id: string;
    counter: number | null;
    chainage: number;
    pipe_fitting_id: string | null;
    date_installed: string | null;
  }>;
  not_laid: Array<{ sequence_number: number; item_id: string }>;
};

export function buildGuideFittingValidation<T extends WwRecordFields & { id: string; counter?: number | null; date_installed?: string | null }>(
  guide: GuideItem[] | null,
  guideEnabled: boolean,
  records: T[]
): GuideFittingValidation | null {
  if (!guideEnabled || !guide?.length) return null;

  const displayRows = buildGuideDisplayRows(guide, records);
  const matched_valid: GuideFittingValidation["matched_valid"] = [];
  const off_guide: GuideFittingValidation["off_guide"] = [];
  const not_laid: GuideFittingValidation["not_laid"] = [];

  for (const row of displayRows) {
    if (row.kind === "guide_record" && row.record) {
      matched_valid.push({
        record_id: row.record.id,
        item_id: row.item_id ?? "",
        sequence_number: row.sequence_number ?? 0,
        pipe_fitting_id: row.record.pipe_fitting_id ?? null,
        chainage: Number(row.record.chainage) || 0,
        counter: row.record.counter ?? null,
      });
    } else if (row.kind === "off_guide" && row.record) {
      off_guide.push({
        id: row.record.id,
        counter: row.record.counter ?? null,
        chainage: Number(row.record.chainage) || 0,
        pipe_fitting_id: row.record.pipe_fitting_id ?? null,
        date_installed: row.record.date_installed ?? null,
      });
    } else if (row.kind === "not_laid" && row.item_id) {
      not_laid.push({
        sequence_number: row.sequence_number ?? 0,
        item_id: row.item_id,
      });
    }
  }

  return { guide_enabled: true, matched_valid, off_guide, not_laid };
}
