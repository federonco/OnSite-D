/**
 * Reads the first sheet of an .xlsx / .xls file and returns pipe/fitting IDs from column A
 * (skips a header row if the first cell looks like a label, not a pipe id).
 */
export async function parsePipeIdsFromExcelFile(file: File): Promise<string[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: "",
  });

  const ids: string[] = [];
  let start = 0;
  const firstCell = String(rows[0]?.[0] ?? "").trim().toLowerCase();
  if (
    firstCell &&
    (firstCell.includes("pipe") ||
      firstCell.includes("fitting") ||
      firstCell === "id" ||
      firstCell.includes("description"))
  ) {
    start = 1;
  }

  for (let i = start; i < rows.length; i++) {
    const cell = rows[i]?.[0];
    if (cell === undefined || cell === null) continue;
    const s = String(cell).trim();
    if (s) ids.push(s);
  }

  return ids;
}
