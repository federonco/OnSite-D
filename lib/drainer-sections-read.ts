import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrapProjectsEmbed, type ProjectEmbed } from "@/lib/embed-projects";
import type { SectionInfo } from "@/lib/reporting/itr-pla-001/types";

/** Columns always available on drainer_sections (no FK embed). */
export const DRAINER_SECTION_BASE =
  "id,name,start_ch,end_ch,direction,itp_number,project_id";

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
  projects?: { name: string | null; number: string | null } | null;
};

/**
 * List sections: try embed first; on failure log and retry without embed so rows still load.
 */
export async function listDrainerSectionsWithProjectFallback(
  supabase: SupabaseClient
): Promise<{
  data: DrainerSectionRow[] | null;
  error: { message: string } | null;
  projectEmbedOk: boolean;
}> {
  const withEmbed = await supabase
    .from("drainer_sections")
    .select(DRAINER_SECTION_WITH_PROJECT_EMBED)
    .order("name");

  if (!withEmbed.error && withEmbed.data) {
    const normalized: DrainerSectionRow[] = withEmbed.data.map((row) => ({
      ...(row as Omit<DrainerSectionRow, "projects">),
      projects: unwrapProjectsEmbed(
        (row as { projects?: ProjectEmbed | ProjectEmbed[] | null }).projects
      ),
    }));
    return { data: normalized, error: null, projectEmbedOk: true };
  }

  console.error(
    "[drainer_sections] SELECT with projects embed failed — falling back to base columns only:",
    withEmbed.error?.message,
    withEmbed.error?.details ?? "",
    withEmbed.error?.hint ?? ""
  );

  const baseOnly = await supabase
    .from("drainer_sections")
    .select(DRAINER_SECTION_BASE)
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
    ...(row as DrainerSectionRow),
    projects: null,
  }));

  return { data: normalized, error: null, projectEmbedOk: false };
}

/** Audit PDF metadata (matches generateAuditReportPdf section shape). */
export type AuditSectionForPdf = {
  name: string;
  direction: string | null;
  start_ch: number | null;
  end_ch: number | null;
  project: ProjectEmbed | null;
};

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

  console.error(
    "[fetchItrSectionById] projects embed failed — fallback:",
    embed.error?.message,
    embed.error?.details ?? ""
  );

  const base = await supabase
    .from("drainer_sections")
    .select("id,name,itp_number")
    .eq("id", sectionId)
    .single();

  if (base.error || !base.data) {
    return {
      section: null,
      error: { message: base.error?.message ?? embed.error?.message ?? "Section not found" },
    };
  }

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

export async function fetchAuditSectionById(
  supabase: SupabaseClient,
  sectionId: string
): Promise<{ section: AuditSectionForPdf | null; error: { message: string } | null }> {
  const embed = await supabase
    .from("drainer_sections")
    .select("id,name,direction,start_ch,end_ch,projects!project_id(name,number)")
    .eq("id", sectionId)
    .single();

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

  const base = await supabase
    .from("drainer_sections")
    .select("id,name,direction,start_ch,end_ch")
    .eq("id", sectionId)
    .single();

  if (base.error || !base.data) {
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
