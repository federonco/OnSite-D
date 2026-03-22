/**
 * ITR-PLA-001 PDF via Puppeteer. Optimized for 1024 MB serverless.
 * - Single page per request
 * - Request interception blocks all external resources
 * - Minimal Chromium args
 * - Always close browser/page in finally
 */

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { PreparedITRData } from "./prepare-data";
import { buildITRHtml } from "./template";
import { getTimeoutMs } from "./thresholds";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--single-process",
  "--no-zygote",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--disable-translate",
  "--memory-pressure-off",
  "--disable-features=TranslateUI",
  "--disable-software-rasterizer",
];

export async function generateWithPuppeteer(
  data: PreparedITRData,
  prebuiltHtml?: string
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const html = prebuiltHtml ?? buildITRHtml(data);
  const safeName = (data.section.name ?? "section").replace(/\s+/g, "-");
  const fileName = `ITR-PLA-001_${safeName}_ITR-${data.pageNumber}_${Date.now()}.pdf`;

  chromium.setGraphicsMode = false;
  let browser;
  let page;
  try {
    browser = await puppeteer.launch({
      args: PUPPETEER_ARGS,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.resourceType() === "document") req.continue();
      else req.abort();
    });

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: getTimeoutMs() });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      preferCSSPageSize: false,
    });

    return {
      buffer: Buffer.from(pdfBuffer),
      contentType: "application/pdf",
      fileName,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close();
  }
}
