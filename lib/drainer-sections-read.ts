import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrapProjectsEmbed, type ProjectEmbed } from "@/lib/embed-projects";

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
