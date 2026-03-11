/**
 * ITR-PLA-001 HTML template for Puppeteer PDF generation.
 * Fixed print layout - A4 landscape.
 */

import {
  DOC_NO,
  EFFECTIVE_DATE,
  REVISION_NO,
  COLORS,
  COL_WIDTHS_PT,
  CATEGORIES,
  COLUMN_HEADERS,
  ASTERISK_ROW,
  NOTES,
} from "./config";
import { mapRecordToCells } from "./mapper";
import type { RecordRow } from "./mapper";
import type { SectionInfo } from "./types";

const TABLE_WIDTH_PT = COL_WIDTHS_PT.reduce((a, b) => a + b, 0);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAndBreak(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

export function buildHtml(params: {
  section: SectionInfo;
  records: RecordRow[];
  pageNoLabel: string;
  logoDataUrl: string | null;
}): string {
  const { section, records, pageNoLabel, logoDataUrl } = params;
  const dataRows = records.map((r) => mapRecordToCells(r));

  const logoImg = logoDataUrl
    ? `<img src="${escapeHtml(logoDataUrl)}" alt="" class="logo" />`
    : '<div class="logo-placeholder">ALKIMOS PIPELINE ALLIANCE</div>';

  const dataRowsHtml = dataRows
    .map(
      (cells) => `
    <tr>
      ${cells.map((cell, i) => `<td class="data-cell">${escapeHtml(cell)}</td>`).join("")}
    </tr>`
    )
    .join("");

  const colHeadersHtml = COLUMN_HEADERS.map(
    (h) => `<th class="col-header">${escapeAndBreak(h)}</th>`
  ).join("");

  const asteriskCellsHtml = COL_WIDTHS_PT.map(
    (_, i) => `<td class="asterisk-cell">${escapeHtml(ASTERISK_ROW[i] ?? "")}</td>`
  ).join("");

  const colgroupHtml = COL_WIDTHS_PT.map((w) => `<col style="width:${w}pt" />`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ITR-PLA-001</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7pt;
      color: ${COLORS.BLACK};
      padding: 48pt;
    }
    .page {
      width: 842pt;
      max-height: 595pt;
    }

    /* Header - compact */
    .header { display: flex; margin-bottom: 4pt; border: 0.5pt solid ${COLORS.BLACK}; }
    .header-left { width: 220pt; border-right: 0.5pt solid ${COLORS.BLACK}; }
    .header-row { display: flex; border-bottom: 0.5pt solid ${COLORS.BLACK}; min-height: 7pt; line-height: 1.1; }
    .header-row:last-child { border-bottom: none; }
    .header-label { width: 95pt; padding: 1pt 3pt; font-size: 7.5pt; font-weight: normal; border-right: 0.5pt solid ${COLORS.BLACK}; }
    .header-value { flex: 1; padding: 1pt 3pt; font-size: 7.5pt; font-weight: normal; }
    .header-right { flex: 1; display: flex; align-items: center; justify-content: space-between; padding: 1pt 3pt; padding-right: 77pt; }
    .header-title { flex: 1; padding-left: 35pt; }
    .header-title-main { font-size: 6.8pt; font-weight: bold; line-height: 1.1; }
    .header-title-sub { font-size: 6.8pt; font-weight: bold; margin-top: 1pt; }
    .logo { height: 22pt; width: 84pt; flex-shrink: 0; object-fit: contain; }
    .logo-placeholder { font-size: 6pt; color: ${COLORS.BLUE}; font-weight: bold; }

    /* Project info - compact */
    .proj-section { margin-bottom: 4pt; border: 0.5pt solid ${COLORS.BLACK}; }
    .proj-header { padding: 2pt 3pt; min-height: 8pt; font-size: 7.5pt; font-weight: bold; text-align: center; background: ${COLORS.WHITE}; border-bottom: 0.5pt solid ${COLORS.BLACK}; line-height: 1.1; }
    .proj-row { display: flex; }
    .proj-cell { flex: 1; padding: 2pt 3pt; min-height: 8pt; border: 0.5pt solid ${COLORS.BLACK}; font-size: 7.5pt; overflow: hidden; line-height: 1.1; }
    .proj-label { font-weight: bold; }
    .proj-value { font-weight: normal; }

    /* Table - compact */
    .table-wrap { border: 0.5pt solid ${COLORS.BLACK}; }
    .pipe-records-header { padding: 2pt 3pt; min-height: 8pt; font-size: 7.5pt; font-weight: bold; text-align: center; background: ${COLORS.WHITE}; border-bottom: 0.5pt solid ${COLORS.BLACK}; line-height: 1.1; }
    .data-table { width: ${TABLE_WIDTH_PT}pt; border-collapse: collapse; table-layout: fixed; }
    .data-table colgroup col { width: attr(width); }
    .data-table td, .data-table th { border: 0.5pt solid ${COLORS.BLACK}; padding: 2pt 3pt; text-align: center; vertical-align: middle; overflow: hidden; line-height: 1.15; }
    .category-row { background: ${COLORS.BLUE}; color: ${COLORS.WHITE}; font-size: 7pt; font-weight: bold; }
    .category-row td { border-color: ${COLORS.BLACK}; padding: 1pt 3pt; }
    .col-header-row { background: ${COLORS.BLUE}; color: ${COLORS.WHITE}; font-size: 4.5pt; font-weight: bold; }
    .col-header-row th { font-size: 4.5pt; line-height: 1.15; padding: 2pt 3pt; }
    .asterisk-row { background: ${COLORS.GREY}; font-size: 4.5pt; }
    .asterisk-row td { padding: 1pt 3pt; }
    .data-row { background: ${COLORS.WHITE}; font-size: 7pt; }
    .data-cell { font-size: 7pt; overflow: hidden; text-overflow: ellipsis; }

    /* Notes - compact */
    .notes { margin-top: 14pt; font-size: 6.8pt; line-height: 1.15; }
    .notes p { margin: 0 0 2pt 0; }

    /* Print: single page, no breaks; repeat headers if table ever overflows */
    thead { display: table-header-group; }
    @media print {
      body { padding: 0; }
      .page { padding: 48pt; page-break-inside: avoid; }
      .table-wrap { page-break-inside: avoid; }
      .notes { page-break-before: avoid; page-break-inside: avoid; }
    }
    @page { size: A4 landscape; margin: 0; }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="header-left">
        <div class="header-row">
          <div class="header-label">Doc No:</div>
          <div class="header-value">${escapeHtml(DOC_NO)}</div>
        </div>
        <div class="header-row">
          <div class="header-label">Effective Date:</div>
          <div class="header-value">${escapeHtml(EFFECTIVE_DATE)}</div>
        </div>
        <div class="header-row">
          <div class="header-label">Revision No:</div>
          <div class="header-value">${escapeHtml(REVISION_NO)}</div>
        </div>
        <div class="header-row">
          <div class="header-label">Page No:</div>
          <div class="header-value">${escapeHtml(pageNoLabel)}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="header-title">
          <div class="header-title-main">PIPE LAYING INSPECTION FIELD RECORD</div>
          <div class="header-title-sub">ITR-PLA-001</div>
        </div>
        ${logoImg}
      </div>
    </header>

    <section class="proj-section">
      <div class="proj-header">PROJECT INFORMATION</div>
      <div class="proj-row">
        <div class="proj-cell"><span class="proj-label">PROJECT NAME: </span><span class="proj-value">${escapeHtml(section.project_name ?? "—")}</span></div>
        <div class="proj-cell"><span class="proj-label">PROJECT NUMBER: </span><span class="proj-value">${escapeHtml(section.project_number ?? "—")}</span></div>
      </div>
      <div class="proj-row">
        <div class="proj-cell"><span class="proj-label">SECTION-SUBLOT: </span><span class="proj-value">${escapeHtml(section.name)}</span></div>
        <div class="proj-cell"><span class="proj-label">ITP: </span><span class="proj-value">${escapeHtml(section.itp_number ?? "—")}</span></div>
      </div>
    </section>

    <section class="table-wrap">
      <div class="pipe-records-header">PIPE RECORDS</div>
      <table class="data-table">
        <colgroup>${colgroupHtml}</colgroup>
        <thead>
          <tr class="category-row">
            ${CATEGORIES.map((c) => `<td colspan="${c.colspan}">${escapeHtml(c.label)}</td>`).join("")}
          </tr>
          <tr class="col-header-row">${colHeadersHtml}</tr>
          <tr class="asterisk-row">${asteriskCellsHtml}</tr>
        </thead>
        <tbody>${dataRowsHtml}</tbody>
      </table>
    </section>

    <div class="notes">
      ${NOTES.map((n) => `<p>${escapeHtml(n)}</p>`).join("")}
    </div>
  </div>
</body>
</html>`;
}
