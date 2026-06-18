import type { SupabaseClient } from "@supabase/supabase-js";

export type SectionTable = "drainer_sections" | "sections";

export type CatalogSection = {
  table: SectionTable;
  id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  qr_token: string | null;
  qr_token_issued_at: string | null;
  scope: string | null;
  app_config: Record<string, unknown> | null;
};

const LEGACY_SELECT =
  "id,name,start_ch,end_ch,direction,qr_token,qr_token_issued_at";
const UNIFIED_SELECT =
  "id,name,start_ch,end_ch,direction,scope,is_active,qr_token,qr_token_issued_at,app_config";

function appConfigRecord(appConfig: unknown): Record<string, unknown> | null {
  if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
    return null;
  }
  return appConfig as Record<string, unknown>;
}

function mapLegacyRow(row: Record<string, unknown>): CatalogSection {
  return {
    table: "drainer_sections",
    id: String(row.id),
    name: String(row.name ?? ""),
    start_ch: row.start_ch != null ? Number(row.start_ch) : null,
    end_ch: row.end_ch != null ? Number(row.end_ch) : null,
    direction: typeof row.direction === "string" ? row.direction : null,
    qr_token: typeof row.qr_token === "string" ? row.qr_token : null,
    qr_token_issued_at:
      typeof row.qr_token_issued_at === "string" ? row.qr_token_issued_at : null,
    scope: null,
    app_config: null,
  };
}

function mapUnifiedRow(row: Record<string, unknown>): CatalogSection {
  return {
    table: "sections",
    id: String(row.id),
    name: String(row.name ?? ""),
    start_ch: row.start_ch != null ? Number(row.start_ch) : null,
    end_ch: row.end_ch != null ? Number(row.end_ch) : null,
    direction: typeof row.direction === "string" ? row.direction : null,
    qr_token: typeof row.qr_token === "string" ? row.qr_token : null,
    qr_token_issued_at:
      typeof row.qr_token_issued_at === "string" ? row.qr_token_issued_at : null,
    scope: typeof row.scope === "string" ? row.scope : null,
    app_config: appConfigRecord(row.app_config),
  };
}

/** Lodge / enter payload shape (legacy columns or app_config on unified). */
export function sectionEnterPayload(section: CatalogSection): {
  id: string;
  name: string;
  joint_types: string[] | null;
  guide_enabled: boolean;
  guide_xml: { sequence_number: number; item_id: string }[] | null;
} {
  const cfg = section.app_config ?? {};
  const jointRaw = cfg.joint_types;
  const joint_types = Array.isArray(jointRaw)
    ? jointRaw.filter((t): t is string => typeof t === "string")
    : null;
  const guideXmlRaw = cfg.guide_xml;
  const guide_xml = Array.isArray(guideXmlRaw)
    ? (guideXmlRaw as { sequence_number: number; item_id: string }[])
    : null;
  return {
    id: section.id,
    name: section.name,
    joint_types,
    guide_enabled: cfg.guide_enabled === true,
    guide_xml,
  };
}

export async function fetchSectionById(
  supabase: SupabaseClient,
  sectionId: string,
  options?: { crewIds?: string[] }
): Promise<CatalogSection | null> {
  const id = sectionId.trim();
  if (!id) return null;
  if (options?.crewIds?.length === 0) return null;

  let legacyQuery = supabase
    .from("drainer_sections")
    .select(LEGACY_SELECT)
    .eq("id", id);
  if (options?.crewIds) {
    legacyQuery = legacyQuery.in("crew_id", options.crewIds);
  }
  const { data: legacy, error: legacyError } = await legacyQuery.maybeSingle();

  if (legacyError) {
    console.error("[section-catalog] legacy fetch failed:", legacyError.message);
    return null;
  }
  if (legacy) return mapLegacyRow(legacy as Record<string, unknown>);

  let unifiedQuery = supabase
    .from("sections")
    .select(UNIFIED_SELECT)
    .eq("id", id);
  if (options?.crewIds) {
    unifiedQuery = unifiedQuery.in("crew_id", options.crewIds);
  }
  const { data: unified, error: unifiedError } = await unifiedQuery.maybeSingle();

  if (unifiedError) {
    console.error("[section-catalog] unified fetch failed:", unifiedError.message);
    return null;
  }
  if (!unified || unified.is_active === false) return null;

  return mapUnifiedRow(unified as Record<string, unknown>);
}

export async function fetchSectionByQrToken(
  supabase: SupabaseClient,
  qrToken: string
): Promise<CatalogSection | null> {
  const token = qrToken.trim();
  if (!token) return null;

  const { data: legacy, error: legacyError } = await supabase
    .from("drainer_sections")
    .select(LEGACY_SELECT)
    .eq("qr_token", token)
    .maybeSingle();

  if (legacyError) {
    console.error("[section-catalog] legacy qr fetch failed:", legacyError.message);
    return null;
  }
  if (legacy) return mapLegacyRow(legacy as Record<string, unknown>);

  const { data: unified, error: unifiedError } = await supabase
    .from("sections")
    .select(UNIFIED_SELECT)
    .eq("qr_token", token)
    .maybeSingle();

  if (unifiedError) {
    console.error("[section-catalog] unified qr fetch failed:", unifiedError.message);
    return null;
  }
  if (!unified || unified.is_active === false) return null;

  return mapUnifiedRow(unified as Record<string, unknown>);
}

export async function ensureSectionQrToken(
  supabase: SupabaseClient,
  sectionId: string
): Promise<{ qr_token: string; qr_token_issued_at: string; table: SectionTable } | null> {
  const section = await fetchSectionById(supabase, sectionId);
  if (!section) return null;

  if (section.qr_token) {
    return {
      qr_token: section.qr_token,
      qr_token_issued_at: section.qr_token_issued_at ?? new Date().toISOString(),
      table: section.table,
    };
  }

  const qr_token = crypto.randomUUID();
  const qr_token_issued_at = new Date().toISOString();
  const table = section.table;

  const { data: updated, error } = await supabase
    .from(table)
    .update({ qr_token, qr_token_issued_at })
    .eq("id", sectionId)
    .select("qr_token, qr_token_issued_at")
    .single();

  if (error || !updated) {
    console.error("[section-catalog] qr token persist failed:", error?.message);
    return null;
  }

  return {
    qr_token: String(updated.qr_token),
    qr_token_issued_at: String(updated.qr_token_issued_at ?? qr_token_issued_at),
    table,
  };
}

/** PostgREST OR filter for pipe records by legacy or unified section id. */
export function pipeRecordsSectionOrFilter(sectionId: string): string {
  return `section_id.eq.${sectionId},unified_section_id.eq.${sectionId}`;
}

export async function verifyQrTokenForSection(
  supabase: SupabaseClient,
  sectionId: string,
  qrToken: string
): Promise<boolean> {
  const section = await fetchSectionById(supabase, sectionId);
  if (!section?.qr_token) return false;
  return section.qr_token === qrToken.trim();
}
