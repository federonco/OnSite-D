/**
 * Shape of `projects` row fields selected in embeds: `projects!project_id(name,number)`.
 * Requires public.projects columns `name` and `number` (not `code`).
 */
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
