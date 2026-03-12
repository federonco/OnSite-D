/**
 * Smoke test for ITR-PLA-001 PDF generation.
 * Run: npm run pdf:smoke
 * Verbose: ITR_PDF_DEBUG=true npm run pdf:smoke
 */

import type { RecordRow } from "./mapper";
import type { SectionInfo } from "./types";
import { generateITRPla001PdfWithFallback } from "./generate-with-fallback";

const SECTION: SectionInfo = {
  name: "Section A",
  project_name: "Test Project",
  project_number: "PRJ-001",
  itp_number: "ITP-001",
};

function mkRecord(overrides: Partial<RecordRow> = {}): RecordRow {
  return {
    date_installed: "2025-01-15",
    chainage: 1000.5,
    pipe_fitting_id: "P-001",
    joint_type: "WR",
    witness_mark: true,
    internal_seal: true,
    deflection_v_sign: "+",
    deflection_v_mm: 5,
    deflection_h_side: "L",
    deflection_h_mm: 3,
    cp_lugs: null,
    ovality_check: true,
    joint_air_test: true,
    cement_liner: true,
    spark_testing: true,
    inspector_name: "J. Smith",
    ...overrides,
  };
}

type Result = { ok: true; renderer: string; bytes: number; ms: number } | { ok: false; error: string };

async function run(name: string, records: RecordRow[], totalPages: number): Promise<Result> {
  const start = Date.now();
  try {
    const r = await generateITRPla001PdfWithFallback(SECTION, records, 1, totalPages);
    const ms = Date.now() - start;
    return { ok: true, renderer: r.source, bytes: r.buffer.length, ms };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e) };
  }
}

async function main() {
  const debug = process.env.ITR_PDF_DEBUG === "true" || process.env.ITR_PDF_DEBUG === "1";
  console.log("ITR-PLA-001 PDF smoke test");
  if (debug) console.log("(ITR_PDF_DEBUG=true — verbose metrics)\n");
  else console.log("");

  const light = [mkRecord()];
  const medium = Array.from({ length: 5 }, (_, i) => mkRecord({ chainage: 1000 + i * 10 }));
  const heavy = Array.from({ length: 9 }, (_, i) => mkRecord({ chainage: 1000 + i * 10, pipe_fitting_id: `P-${i + 1}` }));

  const r1 = await run("Light (1 row)", light, 1);
  const r2 = await run("Medium (5 rows)", medium, 1);
  const r3 = await run("Heavy (9 rows)", heavy, 1);

  console.log("\n--- Summary ---");
  const results = [
    { name: "Light (1 row)", r: r1 },
    { name: "Medium (5 rows)", r: r2 },
    { name: "Heavy (9 rows)", r: r3 },
  ];
  for (const { name, r } of results) {
    if (r.ok) {
      console.log(`${name}: OK | renderer=${r.renderer} | ${r.bytes} bytes | ${r.ms} ms`);
    } else {
      console.log(`${name}: FAIL | ${r.error}`);
    }
  }

  const allOk = r1.ok && r2.ok && r3.ok;
  console.log(allOk ? "\nAll passed." : "\nSome failed.");
  process.exit(allOk ? 0 : 1);
}

main();
