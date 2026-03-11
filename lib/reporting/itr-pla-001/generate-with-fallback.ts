/**
 * ITR-PLA-001 PDF generator: Puppeteer (primary) + React-PDF (fallback).
 * Primary: high-fidelity HTML/CSS via puppeteer-core + @sparticuz/chromium.
 * Fallback: React-PDF when Puppeteer fails (e.g. Vercel cold start, memory).
 */

import type { SectionInfo } from "./types";
import type { RecordRow } from "./mapper";
import { generateITRPla001Pdf } from "./generate";
import { generateITRPla001PdfReact } from "../itr-pla-001-react-pdf";

export type GenerateResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  source: "puppeteer" | "react-pdf";
};

/**
 * Generate ITR-PLA-001 PDF. Tries Puppeteer first; falls back to React-PDF on failure.
 */
export async function generateITRPla001PdfWithFallback(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  totalPages: number,
  options?: { isOpenITR?: boolean }
): Promise<GenerateResult> {
  try {
    const result = await generateITRPla001Pdf(
      section,
      records,
      pageNumber,
      totalPages,
      options
    );
    console.log("[ITR-PLA-001] PDF generated via Puppeteer (primary)");
    return { ...result, source: "puppeteer" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[ITR-PLA-001] Puppeteer failed, falling back to React-PDF:", msg);
    const result = await generateITRPla001PdfReact(
      section,
      records,
      pageNumber,
      totalPages,
      options
    );
    console.log("[ITR-PLA-001] PDF generated via React-PDF (fallback)");
    return { ...result, source: "react-pdf" };
  }
}
