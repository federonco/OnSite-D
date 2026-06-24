import type { GuideItem } from "@/lib/installation-guide-xml";

/** Sort by sequence_number, trim item_id, drop empty rows, re-number 1..N. */
export function normalizeGuideItemsForSave(items: GuideItem[]): GuideItem[] {
  const sorted = [...items]
    .map((row) => ({
      sequence_number: Number(row.sequence_number),
      item_id: String(row.item_id ?? "").trim(),
    }))
    .filter((row) => row.item_id.length > 0 && Number.isFinite(row.sequence_number))
    .sort((a, b) => a.sequence_number - b.sequence_number);

  return sorted.map((row, index) => ({
    item_id: row.item_id,
    sequence_number: index + 1,
  }));
}

function splitCsvLine(line: string): string[] {
  const delim = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(delim).map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  });
}

/** Parse guide CSV (comma or semicolon). Skips header row when col1 is not numeric. */
export function parseGuideCsv(text: string): GuideItem[] {
  const lines = text.split(/\r?\n/);
  const parsed: GuideItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cols = splitCsvLine(line);
    if (cols.length < 2) continue;

    const colSeq = cols[0]?.trim() ?? "";
    const colItem = cols[1]?.trim() ?? "";
    if (!colSeq && !colItem) continue;

    const seq = Number(colSeq);
    if (!Number.isFinite(seq)) continue;

    if (!colItem) continue;

    parsed.push({ sequence_number: seq, item_id: colItem });
  }

  return normalizeGuideItemsForSave(parsed);
}

export function buildGuideCsvTemplate(): string {
  return "sequence_number,item_id\n1,P1\n2,P2\n";
}

export function downloadGuideCsvTemplate(): void {
  const blob = new Blob([buildGuideCsvTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "installation-guide-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function validateGuideItemsPayload(body: unknown): GuideItem[] | null {
  if (!Array.isArray(body)) return null;
  const items: GuideItem[] = [];
  for (const row of body) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const item_id = typeof o.item_id === "string" ? o.item_id.trim() : "";
    const sequence_number = Number(o.sequence_number);
    if (!item_id || !Number.isFinite(sequence_number)) return null;
    items.push({ item_id, sequence_number });
  }
  return items;
}
