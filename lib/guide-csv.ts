import type { GuideItem } from "@/lib/installation-guide-xml";

type GuideCsvRawRow = {
  sequence_number: number;
  item_id: string;
  joint_type: string | null;
};

export type GuideCsvInvalidRow = GuideCsvRawRow & { error: string };

export type GuideCsvParseResult = {
  valid: GuideItem[];
  invalid: GuideCsvInvalidRow[];
};

/** Sort by sequence_number, trim item_id, drop empty rows, re-number 1..N. */
export function normalizeGuideItemsForSave(items: GuideItem[]): GuideItem[] {
  const sorted = [...items]
    .map((row) => ({
      sequence_number: Number(row.sequence_number),
      item_id: String(row.item_id ?? "").trim(),
      joint_type:
        typeof row.joint_type === "string" && row.joint_type.trim()
          ? row.joint_type.trim()
          : null,
    }))
    .filter((row) => row.item_id.length > 0 && Number.isFinite(row.sequence_number))
    .sort((a, b) => a.sequence_number - b.sequence_number);

  return sorted.map((row, index) => {
    const item: GuideItem = { item_id: row.item_id, sequence_number: index + 1 };
    if (row.joint_type) item.joint_type = row.joint_type;
    return item;
  });
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

/** Parse guide CSV rows (2 or 3 columns). Skips header when col1 is not numeric. */
export function parseGuideCsvRaw(text: string): GuideCsvRawRow[] {
  const lines = text.split(/\r?\n/);
  const parsed: GuideCsvRawRow[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cols = splitCsvLine(line);
    if (cols.length < 2) continue;

    const colSeq = cols[0]?.trim() ?? "";
    const colItem = cols[1]?.trim() ?? "";
    const colJoint = cols[2]?.trim() ?? "";
    if (!colSeq && !colItem && !colJoint) continue;

    const seq = Number(colSeq);
    if (!Number.isFinite(seq)) continue;

    if (!colItem) continue;

    parsed.push({
      sequence_number: seq,
      item_id: colItem,
      joint_type: colJoint || null,
    });
  }

  return parsed;
}

export function parseAndValidateGuideCsv(
  text: string,
  allowedJointTypes: string[]
): GuideCsvParseResult {
  const allowed = new Set(allowedJointTypes);
  const valid: GuideItem[] = [];
  const invalid: GuideCsvInvalidRow[] = [];

  for (const row of parseGuideCsvRaw(text)) {
    const jt = row.joint_type?.trim() || null;
    if (jt && !allowed.has(jt)) {
      invalid.push({
        ...row,
        error: `joint_type "${jt}" is not allowed for this section`,
      });
      continue;
    }
    const item: GuideItem = { sequence_number: row.sequence_number, item_id: row.item_id };
    if (jt) item.joint_type = jt;
    valid.push(item);
  }

  return {
    valid: normalizeGuideItemsForSave(valid),
    invalid,
  };
}

/** @deprecated Use parseAndValidateGuideCsv when section joint types are known. */
export function parseGuideCsv(text: string): GuideItem[] {
  return normalizeGuideItemsForSave(
    parseGuideCsvRaw(text).map((row) => ({
      sequence_number: row.sequence_number,
      item_id: row.item_id,
      ...(row.joint_type ? { joint_type: row.joint_type } : {}),
    }))
  );
}

export function buildGuideCsvTemplate(): string {
  return "sequence_number,item_id,joint_type\n1,P1,WR\n2,P2,WB\n";
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

export function validateGuideItemsPayload(
  body: unknown,
  options?: { allowedJointTypes?: string[] | null }
): GuideItem[] | null {
  if (!Array.isArray(body)) return null;
  const allowed = new Set(options?.allowedJointTypes ?? []);
  const items: GuideItem[] = [];
  for (const row of body) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const item_id = typeof o.item_id === "string" ? o.item_id.trim() : "";
    const sequence_number = Number(o.sequence_number);
    if (!item_id || !Number.isFinite(sequence_number)) return null;

    const jointRaw = o.joint_type;
    let joint_type: string | undefined;
    if (jointRaw != null && jointRaw !== "") {
      if (typeof jointRaw !== "string") return null;
      const jt = jointRaw.trim();
      if (jt) {
        if (!allowed.has(jt)) return null;
        joint_type = jt;
      }
    }

    items.push({
      item_id,
      sequence_number,
      ...(joint_type ? { joint_type } : {}),
    });
  }
  return items;
}
