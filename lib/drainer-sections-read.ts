import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrapProjectsEmbed, type ProjectEmbed } from "@/lib/embed-projects";
import type { SectionInfo } from "@/lib/reporting/itr-pla-001/types";
import { ensureSectionQrToken } from "@/lib/section-catalog";

/** Columns always available on drainer_sections (no FK embed). */
export const DRAINER_SECTION_BASE =
  "id,name,start_ch,end_ch,direction,itp_number,project_id,joint_types,guide_enabled,guide_xml";

/** Optional embed; PostgREST fails the whole query if hint/FK/relationship is wrong. */
export const DRAINER_SECTION_WITH_PROJECT_EMBED =
  `${DRAINER_SECTION_BASE},projects!project_id(name,number)`;

export type DrainerSectionRow = {
  id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  itp_number: string | null;
  project_id: string | null;
  joint_types: string[] | null;
  guide_enabled: boolean;
  guide_xml: { sequence_number: number; item_id: string }[] | null;
  projects?: { name: string | null; number: string | null } | null;
  /** Present when listing as admin (includeQrFields). */
  qr_token?: string | null;
  qr_token_issued_at?: string | null;
  /** True when row comes from unified `sections` only (no legacy drainer_sections row). */
  unified_only?: boolean;
};

const UNIFIED_SHARED_SECTION_SELECT =
  "id,name,start_ch,end_ch,direction,app_config,project_id,qr_token,qr_token_issued_at";

type UnifiedSharedSectionRow = {
  id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  app_config: unknown;
  project_id: string | null;
  qr_token?: string | null;
  qr_token_issued_at?: string | null;
};

function appConfigRecord(appConfig: unknown): Record<string, unknown> {
  if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
    return {};
  }
  return appConfig as Record<string, unknown>;
}

function jointTypesFromAppConfig(appConfig: unknown): string[] | null {
  const raw = appConfigRecord(appConfig).joint_types;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string");
}

function guideXmlFromAppConfig(
  appConfig: unknown
): { sequence_number: number; item_id: string }[] | null {
  const raw = appConfigRecord(appConfig).guide_xml;
  if (!Array.isArray(raw)) return null;
  const out: { sequence_number: number; item_id: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const seq = Number(o.sequence_number);
    const item = typeof o.item_id === "string" ? o.item_id.trim() : "";
    if (!Number.isFinite(seq) || !item) continue;
    out.push({ sequence_number: seq, item_id: item });
  }
  return out.length > 0 ? out : null;
}

function legacyIdFromAppConfig(appConfig: unknown): string | null {
  const legacyId = appConfigRecord(appConfig).legacy_id;
  return typeof legacyId === "string" && legacyId.trim() ? legacyId.trim() : null;
}

function mapUnifiedSharedSectionToRow(row: UnifiedSharedSectionRow): DrainerSectionRow {
  const cfg = appConfigRecord(row.app_config);
  const itpRaw = cfg.itp_number;
  return {
    id: row.id,
    name: row.name,
    start_ch: row.start_ch ?? null,
    end_ch: row.end_ch ?? null,
    direction: typeof row.direction === "string" && row.direction.trim() ? row.direction : "onwards",
    itp_number: typeof itpRaw === "string" && itpRaw.trim() ? itpRaw.trim() : null,
    project_id: row.project_id ?? null,
    joint_types: jointTypesFromAppConfig(row.app_config),
    guide_enabled: cfg.guide_enabled === true,
    guide_xml: guideXmlFromAppConfig(row.app_config),
    projects: null,
    qr_token: typeof row.qr_token === "string" ? row.qr_token : null,
    qr_token_issued_at:
      typeof row.qr_token_issued_at === "string" ? row.qr_token_issued_at : null,
    unified_only: true,
  };
}

async function ensureUnifiedQrTokensForAdminList(
  supabase: SupabaseClient,
  sections: DrainerSectionRow[],
  includeQrFields: boolean | undefined
): Promise<DrainerSectionRow[]> {
  if (!includeQrFields) return sections;

  const out: DrainerSectionRow[] = [];
  for (const section of sections) {
    if (!section.unified_only || section.qr_token) {
      out.push(section);
      continue;
    }
    const ensured = await ensureSectionQrToken(supabase, section.id);
    if (!ensured) {
      out.push(section);
      continue;
    }
    out.push({
      ...section,
      qr_token: ensured.qr_token,
      qr_token_issued_at: ensured.qr_token_issued_at,
    });
  }
  return out;
}

async function listSharedUnifiedSections(
  supabase: SupabaseClient
): Promise<{ data: UnifiedSharedSectionRow[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("sections")
    .select(UNIFIED_SHARED_SECTION_SELECT)
    .eq("scope", "shared")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error(
      "[sections] shared pool SELECT failed:",
      error.message,
      error.details ?? "",
      error.hint ?? ""
    );
    return { data: null, error };
  }

  return { data: (data ?? []) as UnifiedSharedSectionRow[], error: null };
}

function mergeLegacyAndSharedSections(
  legacy: DrainerSectionRow[],
  sharedRows: UnifiedSharedSectionRow[]
): DrainerSectionRow[] {
  const legacyIds = new Set(legacy.map((s) => s.id));
  const sharedMapped = sharedRows
    .filter((row) => {
      if (legacyIds.has(row.id)) return false;
      const legacyId = legacyIdFromAppConfig(row.app_config);
      if (legacyId && legacyIds.has(legacyId)) return false;
      return true;
    })
    .map(mapUnifiedSharedSectionToRow);

  return [...legacy, ...sharedMapped].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List sections: try embed first; on failure log and retry without embed so rows still load.
 */
export async function listDrainerSectionsWithProjectFallback(
  supabase: SupabaseClient,
  options?: { includeQrFields?: boolean }
): Promise<{
  data: DrainerSectionRow[] | null;
  error: { message: string } | null;
  projectEmbedOk: boolean;
}> {
  const qrSuffix = options?.includeQrFields ? ",qr_token,qr_token_issued_at" : "";
  const withEmbed = await supabase
    .from("drainer_sections")
    .select(`${DRAINER_SECTION_WITH_PROJECT_EMBED}${qrSuffix}`)
    .order("name");

  if (!withEmbed.error && withEmbed.data) {
    const normalized: DrainerSectionRow[] = withEmbed.data.map((row) => ({
      ...(row as unknown as Omit<DrainerSectionRow, "projects">),
      projects: unwrapProjectsEmbed(
        (row as { projects?: ProjectEmbed | ProjectEmbed[] | null }).projects
      ),
    }));
    const { data: sharedRows, error: sharedError } =
      await listSharedUnifiedSections(supabase);
    const merged = sharedError || !sharedRows
      ? normalized
      : mergeLegacyAndSharedSections(normalized, sharedRows);
    const withQr = await ensureUnifiedQrTokensForAdminList(
      supabase,
      merged,
      options?.includeQrFields
    );
    return { data: withQr, error: null, projectEmbedOk: true };
  }

  console.error(
    "[drainer_sections] SELECT with projects embed failed — falling back to base columns only:",
    withEmbed.error?.message,
    withEmbed.error?.details ?? "",
    withEmbed.error?.hint ?? ""
  );

  const baseOnly = await supabase
    .from("drainer_sections")
    .select(`${DRAINER_SECTION_BASE}${qrSuffix}`)
    .order("name");

  if (baseOnly.error) {
    console.error(
      "[drainer_sections] Fallback SELECT failed:",
      baseOnly.error.message,
      baseOnly.error.details ?? "",
      baseOnly.error.hint ?? ""
    );
    return { data: null, error: baseOnly.error, projectEmbedOk: false };
  }

  const normalized: DrainerSectionRow[] = (baseOnly.data ?? []).map((row) => ({
    ...(row as unknown as DrainerSectionRow),
    projects: null,
  }));

  const { data: sharedRows, error: sharedError } =
    await listSharedUnifiedSections(supabase);
  const merged = sharedError || !sharedRows
    ? normalized
    : mergeLegacyAndSharedSections(normalized, sharedRows);

  const withQr = await ensureUnifiedQrTokensForAdminList(
    supabase,
    merged,
    options?.includeQrFields
  );

  return { data: withQr, error: null, projectEmbedOk: false };
}

/** Audit PDF metadata (matches generateAuditReportPdf section shape). */
export type AuditSectionForPdf = {
  name: string;
  direction: string | null;
  start_ch: number | null;
  end_ch: number | null;
  project: ProjectEmbed | null;
};

import { fetchSectionById } from "@/lib/section-catalog";

/**
 * Single section for ITR PDF/email: try project embed; on PostgREST embed error, load base columns only.
 * Avoids false "Section not found" when the row exists but embed (e.g. projects.number) is broken.
 */
export async function fetchItrSectionById(
  supabase: SupabaseClient,
  sectionId: string
): Promise<{ section: SectionInfo | null; error: { message: string } | null }> {
  const embed = await supabase
    .from("drainer_sections")
    .select("id,name,itp_number,projects!project_id(name,number)")
    .eq("id", sectionId)
    .single();

  if (!embed.error && embed.data) {
    const row = embed.data as {
      name: string;
      itp_number: string | null;
      projects?: ProjectEmbed | ProjectEmbed[] | null;
    };
    return {
      section: {
        name: row.name,
        itp_number: row.itp_number,
        project: unwrapProjectsEmbed(row.projects),
      },
      error: null,
    };
  }

  if (!embed.error || embed.error.code !== "PGRST116") {
    console.error(
      "[fetchItrSectionById] projects embed failed — fallback:",
      embed.error?.message,
      embed.error?.details ?? ""
    );
  }

  const base = await supabase
    .from("drainer_sections")
    .select("id,name,itp_number")
    .eq("id", sectionId)
    .single();

  if (!base.error && base.data) {
    const row = base.data as { name: string; itp_number: string | null };
    return {
      section: {
        name: row.name,
        itp_number: row.itp_number,
        project: null,
      },
      error: null,
    };
  }

  const unified = await fetchSectionById(supabase, sectionId);
  if (unified) {
    const itp =
      typeof unified.app_config?.itp_number === "string"
        ? unified.app_config.itp_number
        : null;
    return {
      section: { name: unified.name, itp_number: itp, project: null },
      error: null,
    };
  }

  return {
    section: null,
    error: { message: base.error?.message ?? embed.error?.message ?? "Section not found" },
  };
}

export async function fetchAuditSectionById(
  supabase: SupabaseClient,
  sectionId: string,
  options?: { crewIds?: string[] }
): Promise<{ section: AuditSectionForPdf | null; error: { message: string } | null }> {
  if (options?.crewIds?.length === 0) {
    return { section: null, error: { message: "Section not found" } };
  }

  let embedQuery = supabase
    .from("drainer_sections")
    .select("id,name,direction,start_ch,end_ch,projects!project_id(name,number)")
    .eq("id", sectionId);
  if (options?.crewIds) {
    embedQuery = embedQuery.in("crew_id", options.crewIds);
  }
  const embed = await embedQuery.single();

  if (!embed.error && embed.data) {
    const row = embed.data as {
      name: string;
      direction: string | null;
      start_ch: number | null;
      end_ch: number | null;
      projects?: ProjectEmbed | ProjectEmbed[] | null;
    };
    return {
      section: {
        name: row.name,
        direction: row.direction,
        start_ch: row.start_ch,
        end_ch: row.end_ch,
        project: unwrapProjectsEmbed(row.projects),
      },
      error: null,
    };
  }

  console.error(
    "[fetchAuditSectionById] projects embed failed — fallback:",
    embed.error?.message,
    embed.error?.details ?? ""
  );

  let baseQuery = supabase
    .from("drainer_sections")
    .select("id,name,direction,start_ch,end_ch")
    .eq("id", sectionId);
  if (options?.crewIds) {
    baseQuery = baseQuery.in("crew_id", options.crewIds);
  }
  const base = await baseQuery.single();

  if (base.error || !base.data) {
    const unified = await fetchSectionById(supabase, sectionId, options);
    if (unified) {
      return {
        section: {
          name: unified.name,
          direction: unified.direction,
          start_ch: unified.start_ch,
          end_ch: unified.end_ch,
          project: null,
        },
        error: null,
      };
    }
    return {
      section: null,
      error: { message: base.error?.message ?? embed.error?.message ?? "Section not found" },
    };
  }

  const row = base.data as {
    name: string;
    direction: string | null;
    start_ch: number | null;
    end_ch: number | null;
  };
  return {
    section: {
      name: row.name,
      direction: row.direction,
      start_ch: row.start_ch,
      end_ch: row.end_ch,
      project: null,
    },
    error: null,
  };
}

export async function fetchCheckpointPrintSectionById(
  supabase: SupabaseClient,
  sectionId: string
): Promise<{
  section: { name: string; project: ProjectEmbed | null } | null;
  error: { message: string } | null;
}> {
  const embed = await supabase
    .from("drainer_sections")
    .select("id,name,projects!project_id(name,number)")
    .eq("id", sectionId)
    .single();

  if (!embed.error && embed.data) {
    const row = embed.data as {
      name: string;
      projects?: ProjectEmbed | ProjectEmbed[] | null;
    };
    return {
      section: {
        name: row.name,
        project: unwrapProjectsEmbed(row.projects),
      },
      error: null,
    };
  }

  console.error(
    "[fetchCheckpointPrintSectionById] projects embed failed — fallback:",
    embed.error?.message,
    embed.error?.details ?? ""
  );

  const base = await supabase
    .from("drainer_sections")
    .select("id,name")
    .eq("id", sectionId)
    .single();

  if (base.error || !base.data) {
    return {
      section: null,
      error: { message: base.error?.message ?? embed.error?.message ?? "Section not found" },
    };
  }

  const row = base.data as { name: string };
  return {
    section: { name: row.name, project: null },
    error: null,
  };
}
