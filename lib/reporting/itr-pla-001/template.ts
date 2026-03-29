/**
 * ITR-PLA-001 HTML for Puppeteer. Aligned with React-PDF Batch 4 layout.
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
import { getLogoSrc } from "./logo";
import type { PreparedITRData } from "./prepare-data";

const WIDTHS = [...COL_WIDTHS_PT];
const FINAL_COLUMN_COUNT = 14; /** Table ends at SIGNATURE. No extra columns. */
const CATEGORY_WIDTHS = [
  WIDTHS.slice(0, 6).reduce((a, b) => a + b, 0),
  WIDTHS.slice(6, 10).reduce((a, b) => a + b, 0),
  WIDTHS.slice(10, 12).reduce((a, b) => a + b, 0),
  WIDTHS.slice(12, 14).reduce((a, b) => a + b, 0),
];

const B = "1px solid #000";
const C = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildITRHtml(data: PreparedITRData): string {
  const { section, dataRows, pageNoLabel } = data;
  const td = (c: string, w?: number, extra?: string) =>
    `<td style="padding:3px 4px;font-size:6pt;border:${B};background:${COLORS.WHITE}${w ? `;width:${w}pt` : ""}${extra || ""}">${C(c)}</td>`;
  const th = (c: string, w: number) =>
    td(c.replace(/\n/g, " "), w, `;background:${COLORS.BLUE};color:${COLORS.WHITE};font-weight:bold;text-align:center`);

  const catRow = CATEGORIES.map((c, i) =>
    `<td style="padding:4px 3px;font-size:6pt;font-weight:bold;border:${B};width:${CATEGORY_WIDTHS[i]}pt;background:${COLORS.BLUE};color:${COLORS.WHITE}">${C(c.label)}</td>`
  ).join("");

  const colRow = COLUMN_HEADERS.slice(0, FINAL_COLUMN_COUNT)
    .map((h, i) => th(h, WIDTHS[i])).join("");
  const astRow = WIDTHS.slice(0, FINAL_COLUMN_COUNT)
    .map((w, i) => td(ASTERISK_ROW[i] ?? "", w, `;background:${COLORS.GREY}`)).join("");

  const dataHtml = dataRows.map((cells) => {
    const row = cells.slice(0, FINAL_COLUMN_COUNT);
    const padded = row.length < FINAL_COLUMN_COUNT
      ? [...row, ...Array(FINAL_COLUMN_COUNT - row.length).fill("")]
      : row;
    return `<tr>${padded.map((cell, ci) => td(cell, WIDTHS[ci])).join("")}</tr>`;
  }).join("");

  const notes = NOTES.map((n) => `<p style="margin:0 0 1px;font-size:6pt;line-height:1.3">${C(n)}</p>`).join("");
  const logoSrc = getLogoSrc();
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="width:52px;height:20px;object-fit:contain" alt="" />`
    : `<div style="width:52px;height:20px;background:${COLORS.GREY};font-size:5pt;display:flex;align-items:center;justify-content:center">LOGO</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:7pt;padding:24pt}table{border-collapse:collapse;width:100%}td{vertical-align:middle}</style></head><body>
<div style="display:flex;border:${B};margin-bottom:5pt">
<div style="width:20%;padding:2px 6px;border-right:${B};font-size:6pt">
<div style="margin-bottom:1px"><span style="font-weight:bold">Doc No:</span> ${C(DOC_NO)}</div>
<div style="margin-bottom:1px"><span style="font-weight:bold">Effective Date:</span> ${C(EFFECTIVE_DATE)}</div>
<div style="margin-bottom:1px"><span style="font-weight:bold">Revision No:</span> ${C(REVISION_NO)}</div>
<div><span style="font-weight:bold">Page No:</span> ${C(pageNoLabel)}</div>
</div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:4px">
<div style="font-size:9pt;font-weight:bold;text-transform:uppercase">PIPE LAYING INSPECTION FIELD RECORD</div>
<div style="font-size:7pt;margin-top:1px">ITR-PLA-001</div>
</div>
<div style="width:20%;display:flex;justify-content:flex-end;align-items:center;padding:4px 6px;border-left:${B}">${logoHtml}</div>
</div>
<div style="border:${B};margin-bottom:5pt"><div style="padding:4px 6px;font-weight:bold;text-align:center;border-bottom:${B}">PROJECT INFORMATION</div>
<div style="display:flex"><div style="flex:3;padding:4px 6px;border-right:${B};border-bottom:${B};font-size:7pt">PROJECT NAME:</div><div style="flex:4;padding:4px 6px;border-right:${B};border-bottom:${B};font-size:7pt">${C(section.project?.name ?? "—")}</div><div style="flex:2;padding:4px 6px;border-right:${B};border-bottom:${B};font-size:7pt">PROJECT NUMBER:</div><div style="flex:5;padding:4px 6px;border-bottom:${B};font-size:7pt">${C(section.project?.number ?? "—")}</div></div>
<div style="display:flex"><div style="flex:3;padding:4px 6px;border-right:${B};border-bottom:${B};font-size:7pt">SECTION-SUBLOT:</div><div style="flex:4;padding:4px 6px;border-right:${B};border-bottom:${B};font-size:7pt">${C(section.name)}</div><div style="flex:3;padding:4px 6px;border-right:${B};border-bottom:${B};font-size:7pt">ITP:</div><div style="flex:4;padding:4px 6px;border-bottom:${B};font-size:7pt">${C(section.itp_number ?? "—")}</div></div></div>
<div style="border:${B};margin-bottom:8pt"><div style="padding:5px 6px;font-size:8pt;font-weight:bold;text-align:center;background:${COLORS.BLUE};color:${COLORS.WHITE};border-bottom:${B}">PIPE RECORDS</div><table><tbody>
<tr>${catRow}</tr><tr>${colRow}</tr><tr>${astRow}</tr>${dataHtml}</tbody></table></div>
<div style="margin-top:6pt;font-size:6pt;line-height:1.3">${notes}</div></body></html>`;
}
