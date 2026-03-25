/**
 * ITR-PLA-001 HTML template for Puppeteer PDF generation.
 * Table-based layout with border-collapse, fixed widths/heights.
 */

import {
  DOC_NO,
  EFFECTIVE_DATE,
  REVISION_NO,
  COLORS,
  COL_WIDTHS_PT,
  ITR_MAX_ROWS,
  CATEGORIES,
  COLUMN_HEADERS,
  ASTERISK_ROW,
  NOTES,
} from "./config";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type TemplateSection = {
  name: string;
  project_name: string | null;
  project_number: string | null;
  itp_number: string | null;
};

export type TemplateOptions = {
  pageNoLabel: string;
  reportNoLabel?: string;
  /** Logo src: data URL (embedded) or URL. Falls back to external if not provided. */
  logoSrc?: string;
};

export function buildItrPla001Html(
  section: TemplateSection,
  dataRows: string[][],
  options: TemplateOptions
): string {
  const projectName = escapeHtml(section.project_name ?? "—");
  const projectNumber = escapeHtml(section.project_number ?? "—");
  const sectionName = escapeHtml(section.name);
  const itpNumber = escapeHtml(section.itp_number ?? "—");

  const BORDER = "0.5pt solid #000";
  function cellHtml(c: string, i: number): string {
    const display = c ?? "";
    return `<td class="data-cell" style="width: ${COL_WIDTHS_PT[i]}pt; border: ${BORDER}; padding: 1pt 2pt;">${escapeHtml(display)}</td>`;
  }
  const normalizedRows = [...dataRows];
  while (normalizedRows.length < ITR_MAX_ROWS) normalizedRows.push([]);

  const dataRowsHtml = normalizedRows
    .map(
      (cells) => {
        const row = cells.slice(0, 14);
        const padded = row.length < 14 ? [...row, ...Array(14 - row.length).fill("")] : row;
        return `
    <tr>
      ${padded.map((c, i) => cellHtml(c, i)).join("")}
    </tr>`;
      }
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ITR-PLA-001</title>
  <style>
    @page { size: A4 landscape; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20pt; font-family: Arial, sans-serif; font-size: 7pt; color: ${COLORS.BLACK}; }
    .header-table { width: 100%; border-collapse: collapse; border: 0.5pt solid ${COLORS.BLACK}; margin-bottom: 4pt; table-layout: fixed; }
    .header-table td { border: 0.5pt solid ${COLORS.BLACK}; vertical-align: middle; padding: 2pt; font-size: 7pt; }
    .header-meta-table { width: 100%; border-collapse: collapse; font-size: 7pt; }
    .header-meta-table td { border: none; padding: 0.5pt 4pt 0.5pt 2pt; vertical-align: middle; }
    .header-meta-label { width: 1%; white-space: nowrap; }
    .header-title-cell { text-align: center; }
    .header-title-main { font-size: 8pt; font-weight: bold; }
    .header-title-sub { font-size: 7pt; margin-top: 1pt; }
    .header-logo-cell { width: 70pt; text-align: right; }
    .logo { width: 65pt; height: 24pt; object-fit: contain; }
    .proj-section { border: 0.5pt solid ${COLORS.BLACK}; margin-bottom: 4pt; }
    .proj-header { padding: 1pt 4pt; font-size: 7pt; font-weight: bold; text-align: center; border-bottom: 0.5pt solid ${COLORS.BLACK}; line-height: 1.1; }
    .proj-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .proj-table tr { height: 7pt; }
    .proj-table td { padding: 0.5pt 2pt; height: 7pt; border-right: 0.5pt solid ${COLORS.BLACK}; border-bottom: 0.5pt solid ${COLORS.BLACK}; font-size: 7pt; width: 50%; vertical-align: middle; }
    .proj-table td:last-child { border-right: none; }
    .table-wrap { margin-bottom: 8pt; page-break-inside: avoid; margin: 0; padding: 0; }
    .pipe-section-table { width: 100%; border-collapse: collapse; border: 0.5pt solid ${COLORS.BLACK}; table-layout: fixed; }
    .pipe-records-title { padding: 3pt 4pt; font-size: 9pt; font-weight: bold; text-align: center; border-bottom: 0.5pt solid ${COLORS.BLACK}; background: ${COLORS.WHITE}; }
    table.pipe-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; }
    table.pipe-table td, table.pipe-table th { border: 0.5pt solid ${COLORS.BLACK}; padding: 1pt 2pt; font-size: 6pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Pipe No Stamp or Fitting ID (data rows): show full value, no ellipsis */
    table.pipe-table td.data-cell:nth-child(3) { white-space: normal; text-overflow: clip; overflow: visible; word-break: break-word; }
    table.pipe-table th.category-cell { padding: 0.5pt 1pt; height: 9pt; font-size: 6pt; font-weight: bold; background: ${COLORS.BLUE}; color: ${COLORS.WHITE}; text-align: center; vertical-align: middle; }
    table.pipe-table th.col-header-cell { padding: 0.5pt 1pt; height: 20pt; font-size: 4.5pt; font-weight: bold; background: ${COLORS.BLUE}; color: ${COLORS.WHITE}; text-align: center; white-space: normal; vertical-align: middle; }
    table.pipe-table th.asterisk-cell { padding: 0.5pt 1pt; height: 7pt; font-size: 5pt; background: ${COLORS.GREY}; vertical-align: middle; }
    table.pipe-table td.data-cell { font-size: 7pt; line-height: 1.1; height: 24pt; max-height: 24pt; overflow: hidden; vertical-align: middle; }
    .notes { margin-top: 12pt; font-size: 6.5pt; line-height: 1.15; page-break-before: avoid; }
    .notes p { margin: 0 0 2pt 0; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 140pt;">
        <table class="header-meta-table">
          <tr><td class="header-meta-label">Doc No:</td><td>${escapeHtml(DOC_NO)}</td></tr>
          <tr><td class="header-meta-label">Effective Date:</td><td>${escapeHtml(EFFECTIVE_DATE)}</td></tr>
          <tr><td class="header-meta-label">Revision No:</td><td>${escapeHtml(REVISION_NO)}</td></tr>
          <tr><td class="header-meta-label">Report No:</td><td>${escapeHtml(options.reportNoLabel ?? "")}</td></tr>
          <tr><td class="header-meta-label">Page No:</td><td>${escapeHtml(options.pageNoLabel)}</td></tr>
        </table>
      </td>
      <td class="header-title-cell">
        <div class="header-title-main">PIPE LAYING INSPECTION FIELD RECORD</div>
        <div class="header-title-sub">ITR-PLA-001</div>
      </td>
      <td class="header-logo-cell">
        <img src="${options.logoSrc ?? ""}" alt="Logo" class="logo" />
      </td>
    </tr>
  </table>

  <div class="proj-section">
    <div class="proj-header">PROJECT INFORMATION</div>
    <table class="proj-table">
      <tr>
        <td>PROJECT NAME: ${projectName}</td>
        <td>PROJECT NUMBER: ${projectNumber}</td>
      </tr>
      <tr>
        <td>SECTION-SUBLOT: ${sectionName}</td>
        <td>ITP: ${itpNumber}</td>
      </tr>
    </table>
  </div>

  <div class="table-wrap">
    <table class="pipe-section-table pipe-table">
      <colgroup>
        ${COL_WIDTHS_PT.map((w) => `<col style="width: ${w}pt" />`).join("")}
      </colgroup>
      <tr><td colspan="14" class="pipe-records-title">PIPE RECORDS</td></tr>
      <tr class="category-row">
          ${CATEGORIES.map(
            (c) =>
              `<th class="category-cell" colspan="${c.colspan}">${escapeHtml(c.label)}</th>`
          ).join("")}
      </tr>
      <tr class="headers-row">
          ${COLUMN_HEADERS.map(
            (h, i) =>
              `<th class="col-header-cell" style="width: ${COL_WIDTHS_PT[i]}pt">${h.split("\n").map((part) => escapeHtml(part)).join("<br/>")}</th>`
          ).join("")}
      </tr>
      <tr class="asterisk-row">
          ${COL_WIDTHS_PT.map(
            (w, i) =>
              `<th class="asterisk-cell" style="width: ${w}pt">${escapeHtml(ASTERISK_ROW[i] ?? "")}</th>`
          ).join("")}
      </tr>
      <tbody>
        ${dataRowsHtml}
      </tbody>
    </table>
  </div>

  <div class="notes">
    ${NOTES.map((n) => `<p>${escapeHtml(n)}</p>`).join("")}
  </div>
</body>
</html>`;
}
