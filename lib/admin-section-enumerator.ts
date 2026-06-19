import type { SupabaseClient } from "@supabase/supabase-js";
import { listDrainerSectionsWithProjectFallback } from "@/lib/drainer-sections-read";
import { fetchSectionById } from "@/lib/section-catalog";

export type AdminSectionRef = { id: string; name: string };

/** Legacy + unified shared sections for admin enumerators (notifications, analysis, etc.). */
export async function listSectionsForAdminEnumeration(
  supabase: SupabaseClient
): Promise<AdminSectionRef[]> {
  const { data, error } = await listDrainerSectionsWithProjectFallback(supabase);
  if (error || !data) return [];
  return data.map((section) => ({ id: section.id, name: section.name }));
}

export function isSectionBackwards(direction: string | null | undefined): boolean {
  const d = String(direction ?? "").toLowerCase();
  return d === "backward" || d === "backwards";
}

export async function fetchSectionDirection(
  supabase: SupabaseClient,
  sectionId: string
): Promise<string | null> {
  const section = await fetchSectionById(supabase, sectionId);
  return section?.direction ?? null;
}
