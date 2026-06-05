/**
 * Weld & Wrap status PDF via Puppeteer + HTML template.
 * Reuses shared launchBrowser from ITR reporting.
 */

import * as fs from "fs";
import * as path from "path";
import { launchBrowser } from "@/lib/reporting/itr-pla-001/puppeteer-launch";
import { buildWeldWrapHtml } from "./weld-wrap-html";
import type { WeldWrapReportData } from "./types";

function getReadxLogoDataUrl(): string {
  const logoPath = path.join(process.cwd(), "public", "readx-logo.png");
  const buf = fs.readFileSync(logoPath);
  const b64 = buf.toString("base64");
  return `data:image/png;base64,${b64}`;
}

export async function generateWeldWrapPdf(
  data: WeldWrapReportData
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const logoSrc = getReadxLogoDataUrl();
  const html = buildWeldWrapHtml(data, logoSrc);

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
      printBackground: true,
      preferCSSPageSize: true,
      scale: 0.95,
    });

    const safeName = (data.section.name ?? "section").replace(/\s+/g, "-");
    const fileName = `Weld-Wrap_${safeName}_${Date.now()}.pdf`;

    return {
      buffer: Buffer.from(pdfBuffer),
      contentType: "application/pdf",
      fileName,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}
