import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeCrewIds(data: unknown): string[] {
  if (!data) return [];
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (typeof row === "string") return row;
      if (row && typeof row === "object" && "crew_id" in row) {
        const crewId = (row as { crew_id: unknown }).crew_id;
        return typeof crewId === "string" ? crewId : null;
      }
      return null;
    })
    .filter((id): id is string => !!id);
}

/** Crew ids the current JWT admin may access (all crews for super_admin). */
export async function getAdminCrewIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_admin_crew_ids");
  if (error) {
    console.error("[admin-crew] get_admin_crew_ids failed:", error.message);
    return [];
  }
  return normalizeCrewIds(data);
}
