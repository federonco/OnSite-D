/**
 * DIAGNOSTIC PATCH: React-PDF only, no Puppeteer.
 *
 * This temporary implementation bypasses Puppeteer completely to determine whether:
 * - the issue is Puppeteer/fallback logic, OR
 * - React-PDF ITR generation itself.
 *
 * TODO: Revert to Puppeteer primary + React-PDF fallback after diagnosis.
 */

import type { SectionInfo } from "./types";
import type { RecordRow } from "./mapper";
import { generateITRPla001PdfReact } from "../itr-pla-001-react-pdf";

export type GenerateResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  source: "puppeteer" | "react-pdf";
};

/**
 * Generate ITR-PLA-001 PDF via React-PDF only (diagnostic).
 */
export async function generateITRPla001PdfWithFallback(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  totalPages: number,
  options?: { isOpenITR?: boolean }
): Promise<GenerateResult> {
  console.log("[ITR-PLA-001] generate-with-fallback version check");
  console.log("[ITR] React-PDF generator executing");
  console.log("[ITR-PLA-001] input data summary:", {
    sectionName: section?.name,
    recordsCount: records?.length,
    pageNumber,
    totalPages,
    isOpenITR: options?.isOpenITR,
  });

  const result = await generateITRPla001PdfReact(
    section,
    records,
    pageNumber,
    totalPages,
    options
  );

  console.log("[ITR-PLA-001] successful PDF buffer size:", result.buffer?.length ?? 0);
  return { ...result, source: "react-pdf" };
}
