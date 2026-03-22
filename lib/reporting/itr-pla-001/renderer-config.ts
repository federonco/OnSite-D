/**
 * ITR-PLA-001 renderer selection.
 * ITR_FORCE_REACT_PDF=true -> always React-PDF
 * ITR_PDF_RENDERER=react-pdf -> React-PDF
 * ITR_PDF_RENDERER=puppeteer -> try Puppeteer, fallback React-PDF
 * ITR_PDF_RENDERER=auto -> heuristic + thresholds
 */

import type { PreparedITRData } from "./prepare-data";
import {
  getMaxInputKb,
  getMaxPreparedKb,
  getMaxHtmlKb,
  getMaxImages,
  getWarnOnly,
  getDebug,
} from "./thresholds";

export type RendererChoice = "react-pdf" | "puppeteer";
export type RendererSelection = { choice: RendererChoice; reason: string };

export type ThresholdMetrics = {
  inputKb: number;
  preparedKb: number;
  htmlKb?: number;
  imagesCount: number;
};

export function getRendererSelection(
  data: PreparedITRData,
  metrics: ThresholdMetrics
): RendererSelection {
  const force = process.env.ITR_FORCE_REACT_PDF;
  if (force === "true" || force === "1") {
    return { choice: "react-pdf", reason: "ITR_FORCE_REACT_PDF=true" };
  }

  const env = (process.env.ITR_PDF_RENDERER ?? "auto").toLowerCase();
  if (env === "react-pdf") return { choice: "react-pdf", reason: "ITR_PDF_RENDERER=react-pdf" };
  if (env === "puppeteer") {
    const over = checkThresholds(metrics);
    if (over && !getWarnOnly()) {
      return { choice: "react-pdf", reason: `ITR_PDF_RENDERER=puppeteer but ${over} exceeded, forcing React-PDF` };
    }
    return { choice: "puppeteer", reason: "ITR_PDF_RENDERER=puppeteer" };
  }

  return selectRendererAuto(data, metrics);
}

/** Returns threshold name if exceeded */
function checkThresholds(m: ThresholdMetrics): string | null {
  if (m.inputKb > getMaxInputKb()) return "max_input_kb";
  if (m.preparedKb > getMaxPreparedKb()) return "max_prepared_kb";
  if (m.htmlKb != null && m.htmlKb > getMaxHtmlKb()) return "max_html_kb";
  if (m.imagesCount > getMaxImages()) return "max_images";
  return null;
}

/** Conservative heuristic + thresholds. Prefer React-PDF. */
function selectRendererAuto(data: PreparedITRData, metrics: ThresholdMetrics): RendererSelection {
  const over = checkThresholds(metrics);
  if (over && !getWarnOnly()) {
    return {
      choice: "react-pdf",
      reason: `Auto: ${over} exceeded, forcing React-PDF`,
    };
  }

  const rows = data.dataRows.length;
  const imagesCount = metrics.imagesCount;
  const hasComplexHtml = false;

  if (hasComplexHtml || imagesCount > 0) {
    if (over) {
      return { choice: "react-pdf", reason: `Auto: would use Puppeteer but ${over} exceeded` };
    }
    return { choice: "puppeteer", reason: `Auto: complex HTML or ${imagesCount} images` };
  }

  const reason = getDebug()
    ? `Auto: structured table, ${rows} rows, 0 images, no custom HTML`
    : `Auto: React-PDF (${rows} rows)`;
  return { choice: "react-pdf", reason };
}
