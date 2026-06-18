import type { SupabaseClient } from "@supabase/supabase-js";

export interface AnalysisCriteria {
  gap_threshold_m: number;
  overlap_threshold_m: number;
  pipe_id_pattern: string;
  near_tolerance_v_warn: number;
  near_tolerance_v_alert: number;
  near_tolerance_h_warn: number;
  near_tolerance_h_alert: number;
  deflection_trend_window: number;
  deflection_trend_v_threshold: number;
  deflection_trend_h_threshold: number;
}

export const DEFAULT_CRITERIA: AnalysisCriteria = {
  gap_threshold_m: 13,
  overlap_threshold_m: 12,
  pipe_id_pattern: "^\\d+-\\d+$",
  near_tolerance_v_warn: 40,
  near_tolerance_v_alert: 45,
  near_tolerance_h_warn: 80,
  near_tolerance_h_alert: 90,
  deflection_trend_window: 4,
  deflection_trend_v_threshold: 15,
  deflection_trend_h_threshold: 20,
};

function toNumberOrDefault(value: unknown, fallback: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

export function mergeCriteria(input?: Partial<AnalysisCriteria> | null): AnalysisCriteria {
  const src = input ?? {};
  return {
    gap_threshold_m: toNumberOrDefault(src.gap_threshold_m, DEFAULT_CRITERIA.gap_threshold_m, 0),
    overlap_threshold_m: toNumberOrDefault(src.overlap_threshold_m, DEFAULT_CRITERIA.overlap_threshold_m, 0),
    pipe_id_pattern:
      typeof src.pipe_id_pattern === "string" && src.pipe_id_pattern.trim()
        ? src.pipe_id_pattern
        : DEFAULT_CRITERIA.pipe_id_pattern,
    near_tolerance_v_warn: toNumberOrDefault(
      src.near_tolerance_v_warn,
      DEFAULT_CRITERIA.near_tolerance_v_warn,
      0
    ),
    near_tolerance_v_alert: toNumberOrDefault(
      src.near_tolerance_v_alert,
      DEFAULT_CRITERIA.near_tolerance_v_alert,
      0
    ),
    near_tolerance_h_warn: toNumberOrDefault(
      src.near_tolerance_h_warn,
      DEFAULT_CRITERIA.near_tolerance_h_warn,
      0
    ),
    near_tolerance_h_alert: toNumberOrDefault(
      src.near_tolerance_h_alert,
      DEFAULT_CRITERIA.near_tolerance_h_alert,
      0
    ),
    deflection_trend_window: toNumberOrDefault(
      src.deflection_trend_window,
      DEFAULT_CRITERIA.deflection_trend_window,
      2
    ),
    deflection_trend_v_threshold: toNumberOrDefault(
      src.deflection_trend_v_threshold,
      DEFAULT_CRITERIA.deflection_trend_v_threshold,
      0
    ),
    deflection_trend_h_threshold: toNumberOrDefault(
      src.deflection_trend_h_threshold,
      DEFAULT_CRITERIA.deflection_trend_h_threshold,
      0
    ),
  };
}

function readCriteriaFromAppConfig(appConfig: unknown): AnalysisCriteria {
  if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
    return DEFAULT_CRITERIA;
  }
  const criteriaRaw = (appConfig as { analysis_criteria?: unknown }).analysis_criteria;
  if (!criteriaRaw || typeof criteriaRaw !== "object" || Array.isArray(criteriaRaw)) {
    return DEFAULT_CRITERIA;
  }
  return mergeCriteria(criteriaRaw as Partial<AnalysisCriteria>);
}

export async function getCriteriaForSectionId(
  supabase: SupabaseClient,
  sectionId: string
): Promise<{
  criteria: AnalysisCriteria;
  unifiedSectionId: string | null;
  unifiedAppConfig: Record<string, unknown> | null;
}> {
  const { data: unifiedById } = await supabase
    .from("sections")
    .select("id, app_config")
    .eq("id", sectionId)
    .maybeSingle();

  if (unifiedById) {
    const appConfig =
      unifiedById.app_config &&
      typeof unifiedById.app_config === "object" &&
      !Array.isArray(unifiedById.app_config)
        ? (unifiedById.app_config as Record<string, unknown>)
        : null;
    return {
      criteria: readCriteriaFromAppConfig(appConfig),
      unifiedSectionId: unifiedById.id,
      unifiedAppConfig: appConfig,
    };
  }

  return getCriteriaForDrainerSection(supabase, sectionId);
}

export async function getCriteriaForDrainerSection(
  supabase: SupabaseClient,
  drainerSectionId: string
): Promise<{
  criteria: AnalysisCriteria;
  unifiedSectionId: string | null;
  unifiedAppConfig: Record<string, unknown> | null;
}> {
  const { data: section } = await supabase
    .from("sections")
    .select("id, app_config")
    .eq("app_config->>legacy_id", drainerSectionId)
    .maybeSingle();

  const appConfig =
    section?.app_config && typeof section.app_config === "object" && !Array.isArray(section.app_config)
      ? (section.app_config as Record<string, unknown>)
      : null;

  return {
    criteria: readCriteriaFromAppConfig(appConfig),
    unifiedSectionId: section?.id ?? null,
    unifiedAppConfig: appConfig,
  };
}

export async function getCriteriaMapForDrainerSections(
  supabase: SupabaseClient,
  drainerSectionIds: string[]
): Promise<Record<string, AnalysisCriteria>> {
  const target = new Set(drainerSectionIds);
  const out: Record<string, AnalysisCriteria> = {};
  if (target.size === 0) return out;

  const { data: rows } = await supabase.from("sections").select("app_config");
  for (const row of rows ?? []) {
    const appConfig =
      row.app_config && typeof row.app_config === "object" && !Array.isArray(row.app_config)
        ? (row.app_config as Record<string, unknown>)
        : null;
    const legacyId = typeof appConfig?.legacy_id === "string" ? appConfig.legacy_id : null;
    if (!legacyId || !target.has(legacyId)) continue;
    out[legacyId] = readCriteriaFromAppConfig(appConfig);
  }
  return out;
}
