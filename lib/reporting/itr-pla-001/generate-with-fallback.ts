/**
 * ITR-PLA-001 PDF orchestration. Guardrails, metrics, strict fallback.
 */

import type { SectionInfo } from "./types";
import type { RecordRow } from "./mapper";
import { getRendererSelection } from "./renderer-config";
import { prepareITRData } from "./prepare-data";
import { generateWithReactPdf } from "./render-react-pdf";
import { bytesOfObject, bytesOfString, bytesOfBuffer, toKb, elapsed } from "./metrics";
import {
  getMaxInputKb,
  getMaxPreparedKb,
  getMaxHtmlKb,
  getMaxRenderMs,
  getWarnOnly,
  getDebug,
} from "./thresholds";

export type GenerateResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  source: "puppeteer" | "react-pdf";
};

function logDebug(msg: string) {
  if (getDebug()) console.log(msg);
}

/** Single summary line for production logs */
function logSummary(renderer: string, fallback: boolean, totalMs: number, reason?: string) {
  const parts = [`[PDF] renderer=${renderer}`, `fallback=${fallback ? "yes" : "no"}`, `total_ms=${totalMs}`];
  if (reason) parts.splice(1, 0, `reason="${reason}"`);
  console.log(parts.join(" | "));
}

export async function generateITRPla001PdfWithFallback(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  totalPages: number,
  options?: { isOpenITR?: boolean }
): Promise<GenerateResult> {
  const totalStart = Date.now();
  const prepStart = Date.now();

  const inputBytes = bytesOfObject({ section, records });
  const inputKb = toKb(inputBytes);
  logDebug(`[PDF] input_kb=${inputKb}`);

  if (inputKb > getMaxInputKb()) {
    console.warn(`[PDF] Warning: threshold exceeded (max_input_kb)`);
  }

  let data;
  try {
    data = prepareITRData(section, records, pageNumber, totalPages, options);
  } catch (err) {
    throw new Error(`PDF prepare failed: ${(err as Error)?.message ?? String(err)}`);
  }

  const preparedKb = toKb(bytesOfObject(data));
  logDebug(`[PDF] input_kb=${inputKb} prepared_kb=${preparedKb} preparation_ms=${elapsed(prepStart)}`);

  if (preparedKb > getMaxPreparedKb()) {
    console.warn(`[PDF] Warning: threshold exceeded (max_prepared_kb)`);
  }

  const metrics: { inputKb: number; preparedKb: number; htmlKb?: number; imagesCount: number } = {
    inputKb,
    preparedKb,
    imagesCount: 0,
  };

  const selection = getRendererSelection(data, metrics);

  if (selection.choice === "react-pdf") {
    return runReactPdf(data, totalStart, false, selection.reason);
  }

  try {
    const { buildITRHtml } = await import("./template");
    const html = buildITRHtml(data);
    const htmlKb = toKb(bytesOfString(html));
    metrics.htmlKb = htmlKb;
    logDebug(`[PDF] html_kb=${htmlKb} images=0`);

    if (htmlKb > getMaxHtmlKb() && !getWarnOnly()) {
      console.warn(`[PDF] Warning: threshold exceeded (max_html_kb), forcing React-PDF`);
      return runReactPdf(data, totalStart, false, "threshold max_html_kb exceeded");
    }

    const { generateWithPuppeteer } = await import("./render-puppeteer");
    const puppStart = Date.now();
    const result = await generateWithPuppeteer(data, html);
    const puppMs = elapsed(puppStart);
    const totalMs = elapsed(totalStart);

    if (puppMs > getMaxRenderMs()) {
      console.warn(`[PDF] Warning: render time exceeded (${puppMs} ms)`);
    }

    logDebug(`[PDF] puppeteer_ms=${puppMs} buffer_kb=${toKb(bytesOfBuffer(result.buffer))}`);
    logSummary("puppeteer", false, totalMs, selection.reason);
    return { ...result, source: "puppeteer" };
  } catch (err) {
    const stage = detectStage(err);
    const msg = (err as Error)?.message ?? String(err);
    console.warn(`[PDF] Puppeteer failed: stage=${stage} | ${msg}`);

    if (msg.toLowerCase().includes("timeout")) {
      throw new Error(`PDF timeout: ${stage}`);
    }

    try {
      return await runReactPdf(data, totalStart, true, selection.reason);
    } catch (fallbackErr) {
      const fm = (fallbackErr as Error)?.message ?? String(fallbackErr);
      throw new Error(`PDF failed: Puppeteer (${stage}), React-PDF (${fm})`);
    }
  }
}

async function runReactPdf(
  data: Awaited<ReturnType<typeof prepareITRData>>,
  totalStart: number,
  fallback: boolean,
  reason?: string
): Promise<GenerateResult> {
  const renderStart = Date.now();
  let result;
  try {
    result = await generateWithReactPdf(data);
  } catch (err) {
    throw new Error(`PDF React-PDF failed: ${(err as Error)?.message ?? String(err)}`);
  }

  logDebug(`[PDF] reactpdf_ms=${elapsed(renderStart)} buffer_kb=${toKb(result.buffer.length)}`);
  logSummary("react-pdf", fallback, elapsed(totalStart), reason);
  return { ...result, source: "react-pdf" };
}

function detectStage(err: unknown): string {
  if (!(err instanceof Error) || !err.stack) return "unknown";
  const s = err.stack;
  if (s.includes("setContent")) return "setContent";
  if (s.includes("page.pdf") || s.includes("page\.pdf")) return "pdf";
  if (s.includes("launch") || s.includes("newPage")) return "launch/page";
  return "unknown";
}
