import type { SupabaseClient } from "@supabase/supabase-js";

export type PipeRecordSectionRef = {
  section_id: string | null;
  unified_section_id: string | null;
};

/**
 * Resolve a lodge/list section id to legacy drainer_sections and/or unified sections.
 * Shared-only unified rows must use unified_section_id with section_id = null.
 */
export async function resolvePipeRecordSectionRef(
  supabase: SupabaseClient,
  sectionOrUnifiedId: string
): Promise<{ ref: PipeRecordSectionRef | null; error?: string }> {
  const id = sectionOrUnifiedId.trim();
  if (!id) {
    return { ref: null, error: "Missing section id" };
  }

  const { data: legacy, error: legacyError } = await supabase
    .from("drainer_sections")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (legacyError) {
    return { ref: null, error: legacyError.message };
  }
  if (legacy) {
    return {
      ref: { section_id: legacy.id, unified_section_id: null },
    };
  }

  const { data: unified, error: unifiedError } = await supabase
    .from("sections")
    .select("id,scope,is_active")
    .eq("id", id)
    .maybeSingle();

  if (unifiedError) {
    return { ref: null, error: unifiedError.message };
  }
  if (!unified || unified.scope !== "shared" || unified.is_active === false) {
    return { ref: null, error: "Section not found" };
  }

  return {
    ref: { section_id: null, unified_section_id: unified.id },
  };
}
