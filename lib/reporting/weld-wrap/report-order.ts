import { sortRecordsForItr, type ItrSectionSpan, type ItrSortableRecord } from "@/lib/drainer";
import type { GuideDisplayRow, WwRecordFields } from "@/lib/guide-record-matching";

function intercalateNotLaidBySequence<T extends WwRecordFields>(
  laidRows: GuideDisplayRow<T>[],
  notLaidRows: GuideDisplayRow<T>[]
): GuideDisplayRow<T>[] {
  const merged = [...laidRows];
  const sortedNotLaid = [...notLaidRows].sort(
    (a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0)
  );

  for (const nl of sortedNotLaid) {
    const seq = nl.sequence_number ?? Infinity;
    const idx = merged.findIndex((r) => (r.sequence_number ?? Infinity) > seq);
    if (idx === -1) merged.push(nl);
    else merged.splice(idx, 0, nl);
  }

  return merged;
}

/** Guide-mode report rows: laid in ITR chainage order, not_laid interleaved by seq, off-guide at end. */
export function orderWeldWrapGuideRows<T extends WwRecordFields & ItrSortableRecord>(
  guideRows: GuideDisplayRow<T>[],
  section?: ItrSectionSpan | null
): GuideDisplayRow<T>[] {
  const notLaid = guideRows.filter((r) => r.kind === "not_laid");
  const offGuide = guideRows.filter((r) => r.kind === "off_guide");
  const guideRecords = guideRows.filter((r) => r.kind === "guide_record" && r.record);

  const laidRecords = guideRecords.map((r) => r.record!);
  const sortedLaidRecords = sortRecordsForItr(laidRecords, section);

  const rowByRecord = new Map<T, GuideDisplayRow<T>>();
  for (const row of guideRecords) {
    if (row.record) rowByRecord.set(row.record, row);
  }

  const sortedLaidRows = sortedLaidRecords
    .map((record) => rowByRecord.get(record))
    .filter((row): row is GuideDisplayRow<T> => row != null);

  const merged = intercalateNotLaidBySequence(sortedLaidRows, notLaid);

  const offGuideRecords = offGuide.map((r) => r.record).filter((r): r is T => r != null);
  const sortedOffRecords = sortRecordsForItr(offGuideRecords, section);
  const offRowByRecord = new Map<T, GuideDisplayRow<T>>();
  for (const row of offGuide) {
    if (row.record) offRowByRecord.set(row.record, row);
  }

  for (const record of sortedOffRecords) {
    const row = offRowByRecord.get(record);
    if (row) merged.push(row);
  }

  return merged;
}
