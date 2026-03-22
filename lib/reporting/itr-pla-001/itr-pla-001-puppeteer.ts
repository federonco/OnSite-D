/**
 * ITR-PLA-001 PDF generator using Puppeteer + HTML template.
 * Parallel to React-PDF implementation — does not replace it.
 * Uses puppeteer-core + @sparticuz/chromium (serverless-safe).
 */

import * as fs from "fs";
import * as path from "path";
import puppeteer, { Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { SectionInfo } from "./types";
import type { RecordRow } from "./mapper";
import { mapRecordToCells } from "./mapper";
import { buildItrPla001Html } from "./itr-pla-001-html-template";

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  chromium.setGraphicsMode = false;
  _browser = await puppeteer.launch({
    headless: true,
    args: chromium.args,
    executablePath: await chromium.executablePath(),
  });
  return _browser;
}

function getLogoDataUrl(): string | undefined {
  const publicDir = path.join(process.cwd(), "public");
  const candidates = ["Alkimos Logo.png"];
  for (const name of candidates) {
    const p = path.join(publicDir, name);
    try {
      const buf = fs.readFileSync(p);
      const b64 = buf.toString("base64");
      const ext = name.endsWith(".png") ? "png" : "jpeg";
      return `data:image/${ext};base64,${b64}`;
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function generateITRPla001PdfHTML(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  _totalPages: number,
  options?: { isOpenITR?: boolean }
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  console.log("[ITR PUPPETEER] step 1: starting");
  const pageNoLabel = options?.isOpenITR ? "In Progress" : "1 of 1";
  const dataRows = records.map((r) => mapRecordToCells(r));
  const logoSrc = getLogoDataUrl();
  if (!logoSrc) {
    throw new Error("ITR-PLA-001: public/Alkimos Logo.png required but not found");
  }
  console.log("[ITR PUPPETEER] logoSrc: Alkimos Logo.png embedded");

  console.log("[ITR PUPPETEER] step 2: building HTML");
  const html = buildItrPla001Html(
    {
      name: section.name,
      project_name: section.project_name,
      project_number: section.project_number,
      itp_number: section.itp_number,
    },
    dataRows,
    { pageNoLabel, logoSrc }
  );
  console.log("[ITR PUPPETEER] step 3: HTML built, length=", html.length);

  const pdfOptions = {
    format: "A4" as const,
    landscape: true,
    margin: { top: "0.333in", right: "0.333in", bottom: "0.333in", left: "0.333in" },
    printBackground: true,
    preferCSSPageSize: true,
    scale: 0.98,
  };
  console.log("[ITR PUPPETEER] step 4: getting browser");
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    console.log("[ITR PUPPETEER] step 5: setContent (before)");
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    console.log("[ITR PUPPETEER] step 6: setContent (after)");
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

    console.log("[ITR PUPPETEER] step 7: page.pdf (before)");
    const pdfBuffer = await page.pdf(pdfOptions);
    console.log("[ITR PUPPETEER] step 8: page.pdf (after) bufferLen=", pdfBuffer?.length ?? 0);

    const safeName = (section.name ?? "section").replace(/\s+/g, "-");
    const fileName = `ITR-PLA-001_${safeName}_ITR-${pageNumber}_${Date.now()}.pdf`;

    return {
      buffer: Buffer.from(pdfBuffer),
      contentType: "application/pdf",
      fileName,
    };
  } finally {
    await page.close();
  }
}

/** Call after generating PDFs to close the browser (optional, for cleanup). */
export async function closePuppeteerBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
