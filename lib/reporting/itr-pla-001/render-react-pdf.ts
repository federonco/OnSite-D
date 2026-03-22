/**
 * ITR-PLA-001 PDF via React-PDF. Thin wrapper.
 */

import type { PreparedITRData } from "./prepare-data";
import { generateITRPla001PdfReact } from "../itr-pla-001-react-pdf";

export async function generateWithReactPdf(
  data: PreparedITRData
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  return generateITRPla001PdfReact(data.section, [], data.pageNumber, 1, {
    isOpenITR: data.pageNoLabel === "In Progress",
    dataRows: data.dataRows,
  });
}
