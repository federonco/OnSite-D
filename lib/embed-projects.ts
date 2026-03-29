/** PostgREST/Supabase FK embed may be typed or returned as a single object or one-element array. */
export type ProjectEmbed = { name: string | null; number: string | null };

export function unwrapProjectsEmbed(
  projects:
    | ProjectEmbed
    | ProjectEmbed[]
    | null
    | undefined
): ProjectEmbed | null {
  if (projects == null) return null;
  return Array.isArray(projects) ? projects[0] ?? null : projects;
}
