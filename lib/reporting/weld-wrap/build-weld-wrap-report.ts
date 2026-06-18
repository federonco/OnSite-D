import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchItrSectionById } from "@/lib/drainer-sections-read";
import { fetchSectionById, pipeRecordsSectionOrFilter } from "@/lib/section-catalog";
import {
  computeBackfillUpTo,
  fetchPspBackfillRecordsForDrainerSection,
  filterCheckpointsInSpan,
  parseCheckpointChainage,
} from "@/lib/weld-wrap/section-context";
import {
  filterRecordsByStatus,
  formatStatusFilterLabel,
  requiresWeldWrap,
  type WeldWrapStatusFilterKey,
} from "./report-filters";
import type { WeldWrapDetailRow, WeldWrapReportData } from "./types";

type DbRecord = {
  counter: number | null;
  chainage: number | null;
  pipe_fitting_id: string | null;
  joint_type: string | null;
  welded_at: string | null;
  wrapped_at: string | null;
  comments: string | null;
};

function formatReportDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function jointTypeLabel(jointType: string | null): string {
  if (jointType === "Transition") return "TR";
  return jointType ?? "—";
}

function isSimpleWeldJoint(jointType: string | null): boolean {
  return jointType === "WR" || jointType === "Transition";
}

function mapDetailRow(record: DbRecord): WeldWrapDetailRow {
  const isWelded = record.welded_at != null;
  const isWrapped = record.wrapped_at != null;
  const needsWw = requiresWeldWrap(record.joint_type);
  return {
    counter: record.counter,
    chainage: record.chainage,
    pipe_fitting_id: record.pipe_fitting_id,
    jointTypeLabel: jointTypeLabel(record.joint_type),
    weldedLabel: formatReportDate(record.welded_at),
    wrappedLabel: formatReportDate(record.wrapped_at),
    comments: record.comments,
    pending: needsWw && (!isWelded || !isWrapped),
  };
}

export async function buildWeldWrapReportData(
  supabase: SupabaseClient,
  sectionId: string,
  statusFilters?: WeldWrapStatusFilterKey[] | null
): Promise<{ data: WeldWrapReportData | null; error?: string; status: number }> {
  const { section, error: sectionErr } = await fetchItrSectionById(supabase, sectionId);
  if (!section) {
    return {
      data: null,
      error: sectionErr?.message ?? "Section not found",
      status: 404,
    };
  }

  const recordsSelectWithComments =
    "counter,chainage,pipe_fitting_id,joint_type,welded_at,wrapped_at,comments";
  const recordsSelectBase =
    "counter,chainage,pipe_fitting_id,joint_type,welded_at,wrapped_at";

  let { data: recordsData, error: recordsError } = await supabase
    .from("drainer_pipe_records")
    .select(recordsSelectWithComments)
    .or(pipeRecordsSectionOrFilter(sectionId))
    .in("joint_type", ["WR", "WB", "Transition"])
    .order("chainage", { ascending: true });

  if (recordsError?.message?.includes("comments")) {
    const fallback = await supabase
      .from("drainer_pipe_records")
      .select(recordsSelectBase)
      .or(pipeRecordsSectionOrFilter(sectionId))
      .in("joint_type", ["WR", "WB", "Transition"])
      .order("chainage", { ascending: true });
    recordsData = fallback.data?.map((row) => ({ ...row, comments: null })) ?? null;
    recordsError = fallback.error;
  }

  if (recordsError) {
    return { data: null, error: recordsError.message, status: 500 };
  }

  const records = (recordsData ?? []) as DbRecord[];
  const filteredRecords = filterRecordsByStatus(records, statusFilters);

  const wrRecords = records.filter((r) => isSimpleWeldJoint(r.joint_type));
  const wbRecords = records.filter((r) => r.joint_type === "WB");
  const wrWeldsDone = wrRecords.filter((r) => r.welded_at != null).length;
  const wbWeldsDone = wbRecords.filter((r) => r.welded_at != null).length;
  const wrapsDone = records.filter((r) => r.wrapped_at != null).length;
  const wwRecords = records.filter((r) => requiresWeldWrap(r.joint_type));

  const generatedAtLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const catalogSection = await fetchSectionById(supabase, sectionId);
  const startCh = catalogSection?.start_ch ?? null;
  const endCh = catalogSection?.end_ch ?? null;
  const direction = catalogSection?.direction ?? null;

  const { records: pspRecordRows, error: pspError } =
    await fetchPspBackfillRecordsForDrainerSection(supabase, sectionId);

  if (pspError) {
    return { data: null, error: pspError, status: 500 };
  }
  const backfillUpTo = computeBackfillUpTo(pspRecordRows, direction);

  const { data: checkpointRows } = await supabase.from("checkpoints").select("*");
  const parsedCheckpoints = (checkpointRows ?? [])
    .map((row) => {
      const ch = parseCheckpointChainage(row as Record<string, unknown>);
      if (ch == null) return null;
      const r = row as {
        id: string;
        name: string;
        type?: string;
        is_active?: boolean | null;
        active?: boolean | null;
      };
      return {
        id: r.id,
        name: r.name,
        chainage: ch,
        type: r.type ?? "Info",
        is_active: r.is_active ?? r.active ?? true,
      };
    })
    .filter((cp): cp is NonNullable<typeof cp> => cp != null);

  const reportData: WeldWrapReportData = {
    section,
    summary: {
      wrWeldsDone,
      wrWeldsPending: wrRecords.length - wrWeldsDone,
      wbWeldsDone,
      wbWeldsPending: wbRecords.length - wbWeldsDone,
      wrapsDone,
      wrapsPending: wwRecords.length - wrapsDone,
    },
    rows: filteredRecords.map(mapDetailRow),
    generatedAtLabel,
    filterLabel: formatStatusFilterLabel(statusFilters),
    sectionContext: {
      startCh,
      endCh,
      direction,
      backfillUpTo,
      checkpoints: filterCheckpointsInSpan(
        parsedCheckpoints,
        startCh,
        endCh,
        backfillUpTo,
        direction
      ),
    },
  };

  return { data: reportData, status: 200 };
}
