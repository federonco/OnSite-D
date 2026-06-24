import type { SectionInfo } from "@/lib/reporting/itr-pla-001/types";
import type { WeldWrapSectionContext } from "@/lib/weld-wrap/section-context";
import type { GuideRowStatus } from "@/lib/guide-record-matching";

export type WeldWrapSummary = {
  wrWeldsDone: number;
  wrWeldsPending: number;
  wbWeldsDone: number;
  wbWeldsPending: number;
  wrapsDone: number;
  wrapsPending: number;
  guideDone?: number;
  guideLaidPending?: number;
  guideNotLaid?: number;
  guideOffGuide?: number;
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
  guideStatus?: GuideRowStatus;
  guideItemId?: string | null;
  guideSequence?: number | null;
  pendingDetailLabel?: string | null;
  isGuideMode?: boolean;
};

export type WeldWrapReportData = {
  section: SectionInfo;
  summary: WeldWrapSummary;
  rows: WeldWrapDetailRow[];
  generatedAtLabel: string;
  filterLabel: string;
  guideMode?: boolean;
  sectionContext?: WeldWrapSectionContext | null;
};
