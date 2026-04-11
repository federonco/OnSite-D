/**
 * Single-page QR PDF for a section (Puppeteer + HTML), for email attachment.
 * Not for email HTML — base64 in img is only inside the page passed to Puppeteer.
 */

import QRCode from "qrcode";
import { launchBrowser } from "./itr-pla-001/puppeteer-launch";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(sectionName: string, qrDataUrl: string): string {
  const title = escapeHtml(sectionName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
  }
  .wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 32px 24px;
  }
  h1 {
    font-size: 20px;
    font-weight: bold;
    color: #1a5276;
    margin: 0 0 32px 0;
    text-align: center;
    line-height: 1.3;
  }
  .qr img {
    display: block;
    width: 400px;
    height: 400px;
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${title}</h1>
    <div class="qr"><img src="${qrDataUrl}" alt="" width="400" height="400"/></div>
  </div>
</body>
</html>`;
}

/**
 * Renders a minimal A5 portrait PDF: section title + QR only (no URL, footer, or logo).
 */
export async function generateSectionQrPdf(
  sectionName: string,
  qrUrl: string
): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 400,
    margin: 2,
  });

  const html = buildHtml(sectionName, qrDataUrl);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

    const pdfUint8 = await page.pdf({
      format: "A5",
      landscape: false,
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfUint8);
  } finally {
    await page.close();
    await browser.close();
  }
}
