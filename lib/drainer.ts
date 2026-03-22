/** ITR grouping: 9 records per ITR page */
export const ITR_PAGE_SIZE = 9;

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

