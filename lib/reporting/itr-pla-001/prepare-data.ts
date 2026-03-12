/**
 * Prepare ITR-PLA-001 data for rendering. Minimal payload, no duplication.
 * Only fields used by renderers are kept.
 */

import type { SectionInfo } from "./types";
import type { RecordRow } from "./mapper";
import { mapRecordToCells } from "./mapper";

/** Minimal render payload — only what template needs */
export type PreparedITRData = {
  section: Pick<SectionInfo, "name" | "project_name" | "project_number" | "itp_number">;
  dataRows: string[][];
  pageNumber: number;
  pageNoLabel: string;
};

export function prepareITRData(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  _totalPages: number,
  options?: { isOpenITR?: boolean }
): PreparedITRData {
  const isOpenITR = options?.isOpenITR ?? records.length < 9;
  const pageNoLabel = isOpenITR ? "In Progress" : "1 of 1";
  const dataRows = records.map((r) => mapRecordToCells(r));
  return {
    section: { name: section.name, project_name: section.project_name, project_number: section.project_number, itp_number: section.itp_number },
    dataRows,
    pageNumber,
    pageNoLabel,
  };
}
