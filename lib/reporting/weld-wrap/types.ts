import type { SectionInfo } from "@/lib/reporting/itr-pla-001/types";
import type { WeldWrapSectionContext } from "@/lib/weld-wrap/section-context";

export type WeldWrapSummary = {
  wrWeldsDone: number;
  wrWeldsPending: number;
  wbWeldsDone: number;
  wbWeldsPending: number;
  wrapsDone: number;
  wrapsPending: number;
};

export type WeldWrapDetailRow = {
  counter: number | null;
  chainage: number | null;
  pipe_fitting_id: string | null;
  jointTypeLabel: string;
  weldedLabel: string;
  wrappedLabel: string;
  comments: string | null;
  pending: boolean;
};

export type WeldWrapReportData = {
  section: SectionInfo;
  summary: WeldWrapSummary;
  rows: WeldWrapDetailRow[];
  generatedAtLabel: string;
  filterLabel: string;
  sectionContext?: WeldWrapSectionContext | null;
};
