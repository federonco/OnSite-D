import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchItrSectionById } from "@/lib/drainer-sections-read";
import { fetchSectionById, fetchUnifiedSectionByCatalogId, pipeRecordsSectionOrFilter } from "@/lib/section-catalog";
import {
  buildGuideDisplayRows,
  formatWwPendingDetail,
  isRecordWelded,
  type GuideDisplayRow,
} from "@/lib/guide-record-matching";
import { guideConfigFromAppConfig, guideModeContextFields, recordMatchesJointTypes } from "@/lib/section-app-config";
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

const DEFAULT_JOINT_TYPES = ["WR", "WB", "Transition"];

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
  const isWelded = isRecordWelded(record);
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

function mapGuideDisplayRow(row: GuideDisplayRow<DbRecord>): WeldWrapDetailRow {
  if (row.kind === "not_laid") {
    return {
      counter: null,
      chainage: null,
      pipe_fitting_id: row.item_id,
      jointTypeLabel: "—",
      weldedLabel: "—",
      wrappedLabel: "—",
      comments: null,
      pending: true,
      guideStatus: "not_laid",
      guideItemId: row.item_id,
      guideSequence: row.sequence_number,
      isGuideMode: true,
    };
  }

  const record = row.record!;
  const base = mapDetailRow(record);
  return {
    ...base,
    guideStatus: row.status,
    guideItemId: row.item_id,
    guideSequence: row.sequence_number,
    pendingDetailLabel: row.pendingDetail
      ? formatWwPendingDetail(row.pendingDetail)
      : null,
    isGuideMode: true,
    pending:
      row.status === "laid_ww_pending" ||
      row.status === "off_guide",
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

  const catalogSection =
    (await fetchUnifiedSectionByCatalogId(supabase, sectionId)) ??
    (await fetchSectionById(supabase, sectionId));
  const guideCfg = guideConfigFromAppConfig(catalogSection?.app_config ?? null);
  const guideMode = guideCfg.guideMode;
  const jointTypes = guideMode
    ? guideCfg.joint_types ?? DEFAULT_JOINT_TYPES
    : DEFAULT_JOINT_TYPES;

  const recordsSelectWithComments =
    "counter,chainage,pipe_fitting_id,joint_type,welded_at,wrapped_at,comments,welded_steps";
  const recordsSelectBase =
    "counter,chainage,pipe_fitting_id,joint_type,welded_at,wrapped_at,welded_steps";

  let query = supabase
    .from("drainer_pipe_records")
    .select(recordsSelectWithComments)
    .eq("unified_section_id", sectionId);

  if (!guideMode) {
    query = supabase
      .from("drainer_pipe_records")
      .select(recordsSelectWithComments)
      .or(pipeRecordsSectionOrFilter(sectionId));
  }

  let { data: recordsData, error: recordsError } = await query
    .in("joint_type", jointTypes)
    .order("chainage", { ascending: true });

  if (recordsError?.message?.includes("comments")) {
    let fallbackQuery = supabase
      .from("drainer_pipe_records")
      .select(recordsSelectBase)
      .in("joint_type", jointTypes)
      .order("chainage", { ascending: true });
    fallbackQuery = guideMode
      ? fallbackQuery.eq("unified_section_id", sectionId)
      : fallbackQuery.or(pipeRecordsSectionOrFilter(sectionId));
    const fallback = await fallbackQuery;
    recordsData = fallback.data?.map((row) => ({ ...row, comments: null })) ?? null;
    recordsError = fallback.error;
  }

  if (recordsError) {
    return { data: null, error: recordsError.message, status: 500 };
  }

  const records = ((recordsData ?? []) as DbRecord[]).filter((r) =>
    recordMatchesJointTypes(r.joint_type, jointTypes)
  );
  const filteredRecords = filterRecordsByStatus(records, statusFilters);

  const wrRecords = records.filter((r) => isSimpleWeldJoint(r.joint_type));
  const wbRecords = records.filter((r) => r.joint_type === "WB");
  const wrWeldsDone = wrRecords.filter((r) => isRecordWelded(r)).length;
  const wbWeldsDone = wbRecords.filter((r) => isRecordWelded(r)).length;
  const wrapsDone = records.filter((r) => r.wrapped_at != null).length;
  const wwRecords = records.filter((r) => requiresWeldWrap(r.joint_type));

  let rows: WeldWrapDetailRow[];
  let guideSummary: WeldWrapReportData["summary"] | null = null;

  if (guideMode && guideCfg.guide_xml) {
    const guideRows = buildGuideDisplayRows(guideCfg.guide_xml, filteredRecords);
    rows = guideRows.map(mapGuideDisplayRow);
    guideSummary = {
      wrWeldsDone,
      wrWeldsPending: wrRecords.length - wrWeldsDone,
      wbWeldsDone,
      wbWeldsPending: wbRecords.length - wbWeldsDone,
      wrapsDone,
      wrapsPending: wwRecords.length - wrapsDone,
      guideDone: guideRows.filter((r) => r.status === "done").length,
      guideLaidPending: guideRows.filter((r) => r.status === "laid_ww_pending").length,
      guideNotLaid: guideRows.filter((r) => r.status === "not_laid").length,
      guideOffGuide: guideRows.filter((r) => r.status === "off_guide").length,
    };
  } else {
    rows = filteredRecords.map(mapDetailRow);
  }

  const generatedAtLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

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
    summary: guideSummary ?? {
      wrWeldsDone,
      wrWeldsPending: wrRecords.length - wrWeldsDone,
      wbWeldsDone,
      wbWeldsPending: wbRecords.length - wbWeldsDone,
      wrapsDone,
      wrapsPending: wwRecords.length - wrapsDone,
    },
    rows,
    generatedAtLabel,
    filterLabel: formatStatusFilterLabel(statusFilters),
    guideMode,
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
      ...guideModeContextFields(guideCfg),
    },
  };

  return { data: reportData, status: 200 };
}
