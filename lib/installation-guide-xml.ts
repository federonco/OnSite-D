export type GuideXmlEntry = { sequence_number: number; item_id: string };

/** Alias for API / DB shape (column still named guide_xml). */
export type GuideItem = GuideXmlEntry;

/** Parse installation guide from first sheet: columns `sequence_number`, `item_id` (header row 1). */
export async function parseGuideXLSX(buffer: ArrayBuffer): Promise<GuideItem[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<{
    sequence_number?: number | string;
    item_id?: string | number;
  }>(ws);

  const parsed = rows
    .filter(
      (r) =>
        r.sequence_number != null &&
        r.sequence_number !== "" &&
        r.item_id != null &&
        String(r.item_id).trim() !== ""
    )
    .map((r) => ({
      sequence_number: Number(r.sequence_number),
      item_id: String(r.item_id).trim(),
    }))
    .filter((r) => Number.isFinite(r.sequence_number));

  parsed.sort((a, b) => a.sequence_number - b.sequence_number);
  return parsed;
}

/** Coerce PostgREST jsonb / API JSON into a sorted guide list. */
export function normalizeGuideXmlFromJsonb(
  raw: unknown
): GuideItem[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: GuideItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = o.item_id;
    const seq = o.sequence_number;
    if (typeof id !== "string" || id.trim() === "") continue;
    const n = Number(seq);
    if (!Number.isFinite(n)) continue;
    out.push({ sequence_number: n, item_id: id.trim() });
  }
  out.sort((a, b) => a.sequence_number - b.sequence_number);
  return out.length > 0 ? out : null;
}
