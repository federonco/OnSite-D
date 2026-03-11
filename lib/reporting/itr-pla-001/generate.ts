/**
 * ITR-PLA-001 PDF generation via Puppeteer (HTML/CSS → PDF).
 * Replaces React-PDF for print-first technical report fidelity.
 * Max 9 rows per page — see config.ITR_MAX_ROWS.
 *
 * Uses puppeteer-core + @sparticuz/chromium for serverless (Vercel) compatibility.
 * Local dev: set CHROME_EXECUTABLE_PATH to use system Chrome, or let @sparticuz/chromium
 * download Chromium on first run.
 */

import path from "path";
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { buildHtml } from "./template";
import { ITR_MAX_ROWS } from "./config";
import type { SectionInfo } from "./types";
import type { RecordRow } from "./mapper";

const LOGO_URL = "https://raw.githubusercontent.com/federonco/readx-assets/main/Alkimos_logo.png";

/** Disable WebGL for serverless (saves memory; PDF generation does not need it) */
chromium.setGraphicsMode = false;

/** Resolve Chromium executable path: local override or serverless bundle */
async function getChromiumExecutablePath(): Promise<string> {
  const override = process.env.CHROME_EXECUTABLE_PATH?.trim();
  return override || (await chromium.executablePath());
}

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const publicPath = path.join(process.cwd(), "public", "alkimos-logo.png");
    if (fs.existsSync(publicPath)) {
      const buf = fs.readFileSync(publicPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    /* ignore */
  }
  try {
    for (const name of ["Alkimos_logo.png", "Alkimos logo.png"]) {
      const uploadsPath = path.join(process.cwd(), "app", "uploads", name);
      if (fs.existsSync(uploadsPath)) {
        const buf = fs.readFileSync(uploadsPath);
        return `data:image/png;base64,${buf.toString("base64")}`;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function generateITRPla001Pdf(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  totalPages: number,
  options?: { isOpenITR?: boolean }
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  if (records.length > ITR_MAX_ROWS) {
    throw new Error(
      `ITR-PLA-001 supports a maximum of ${ITR_MAX_ROWS} rows per page. Received ${records.length}. Split records into multiple ITRs.`
    );
  }
  const pageRecords = records;
  const logoDataUrl = await fetchLogoDataUrl();
  const pageNoLabel = options?.isOpenITR ? "In Progress" : "1 of 1";

  const html = buildHtml({
    section,
    records: pageRecords,
    pageNoLabel,
    logoDataUrl,
  });

  console.log("[ITR-PLA-001] generate: start", {
    sectionName: section?.name,
    recordsCount: records?.length,
    pageNumber,
    pageNoLabel,
  });
  console.log("[ITR-PLA-001] generate: HTML length:", html?.length ?? 0);
  let browser;
  try {
    const executablePath = await getChromiumExecutablePath();
    console.log("[ITR-PLA-001] generate: executablePath resolved:", executablePath?.slice(0, 80) + (executablePath?.length > 80 ? "…" : ""));
    console.log("[ITR-PLA-001] generate: chromium.args count:", chromium.args?.length ?? 0);
    console.log("[ITR-PLA-001] generate: before puppeteer.launch");
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    console.log("[ITR-PLA-001] generate: after browser launch");

    const page = await browser.newPage();
    console.log("[ITR-PLA-001] generate: after newPage");
    await page.setContent(html, { waitUntil: "networkidle0" });
    console.log("[ITR-PLA-001] generate: after setContent");
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: false,
      scale: 0.98,
    });
    console.log("[ITR-PLA-001] generate: after page.pdf, buffer size:", pdfBuffer?.byteLength ?? 0);

    const safeName = (section.name ?? "section").replace(/\s+/g, "-");
    return {
      buffer: Buffer.from(pdfBuffer),
      contentType: "application/pdf",
      fileName: `ITR-PLA-001_${safeName}_ITR-${pageNumber}_${Date.now()}.pdf`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[ITR-PLA-001] generate: error:", { message: msg, stack, error: err });
    throw err;
  } finally {
    if (browser) await browser.close();
    console.log("[ITR-PLA-001] generate: after browser.close");
  }
}
