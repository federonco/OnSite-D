/** ITR grouping: 9 records per ITR page */
export const ITR_PAGE_SIZE = 9;

/** Typical centre-to-centre pipe spacing (m) for estimating section pipe count from chainage span. */
export const DEFAULT_NOMINAL_PIPE_SPACING_M = 12;

/**
 * Minimum ITR pages required to cover a section (guide item count or chainage span estimate).
 */
export function computeMinItrRequired(
  startCh: number | null,
  endCh: number | null,
  options?: { guideItemCount?: number; pipeSpacingM?: number }
): number | null {
  const guideCount = options?.guideItemCount;
  if (guideCount != null && guideCount > 0) {
    return Math.max(1, Math.ceil(guideCount / ITR_PAGE_SIZE));
  }
  if (startCh == null || endCh == null) return null;
  const span = Math.abs(endCh - startCh);
  if (!Number.isFinite(span) || span <= 0) return null;
  const spacing = options?.pipeSpacingM ?? DEFAULT_NOMINAL_PIPE_SPACING_M;
  const estimatedPipes = Math.max(1, Math.ceil(span / spacing));
  return Math.max(1, Math.ceil(estimatedPipes / ITR_PAGE_SIZE));
}

/** Overall section progress vs minimum ITR capacity (installed records / minItr * 9). */
export function computeSectionItrProgress(
  installedCount: number,
  minItrRequired: number | null
): number {
  if (!minItrRequired || minItrRequired <= 0) return 0;
  const totalSlots = minItrRequired * ITR_PAGE_SIZE;
  if (totalSlots <= 0) return 0;
  return Math.min(100, Math.round((installedCount / totalSlots) * 1000) / 10);
}

export function getSectionKebab(sectionName: string): string {
  return (sectionName ?? "section").replace(/\s+/g, "-");
}

/** Groups records into ITR pages (9 per page). Expects records ordered by chainage descending. */
export function groupRecordsIntoITRs<T>(records: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < records.length; i += ITR_PAGE_SIZE) {
    pages.push(records.slice(i, i + ITR_PAGE_SIZE));
  }
  return pages;
}

export function getITRProgress(recordCount: number): {
  completeITRs: number;
  currentOpenCount: number;
  currentOpenTotal: number;
  percent: number;
  reportPercent: number;
} {
  const completeITRs = Math.floor(recordCount / ITR_PAGE_SIZE);
  const currentOpenCount = recordCount % ITR_PAGE_SIZE;
  const currentOpenTotal = ITR_PAGE_SIZE;
  const totalSlots = Math.ceil(recordCount / ITR_PAGE_SIZE) * ITR_PAGE_SIZE;
  const hasOpenReport = currentOpenCount > 0;
  const totalReports = completeITRs + (hasOpenReport ? 1 : 0);
  const reportPercent =
    totalReports > 0 ? Math.round((completeITRs / totalReports) * 100) : 0;
  const percent =
    totalSlots > 0
      ? Math.min(100, Math.round((recordCount / totalSlots) * 100))
      : 0;
  return { completeITRs, currentOpenCount, currentOpenTotal, percent, reportPercent };
}

