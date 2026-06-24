import type { WeldWrapReportData } from "./types";
import { formatGuideNotLaidStatus } from "@/lib/guide-record-matching";
import { findClosestChainageRowIndex } from "@/lib/weld-wrap/section-context";
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function projectLabel(section: WeldWrapReportData["section"]): string {
  const name = section.project?.name?.trim();
  const number = section.project?.number?.trim();
  if (name && number) return `${name} (${number})`;
  return name || number || "—";
}

function guideStatusLabel(row: WeldWrapReportData["rows"][number]): string {
  switch (row.guideStatus) {
    case "done":
      return "Done";
    case "laid_ww_pending":
      return row.pendingDetailLabel ? `Laid — ${row.pendingDetailLabel}` : "Laid, W/W pending";
    case "not_laid":
      return formatGuideNotLaidStatus(row.guideItemId, row.expectedJointType);
    case "off_guide":
      return "Off-guide";
    default:
      return row.pending ? "Pending" : "Done";
  }
}

function detailRowBackground(
  row: WeldWrapReportData["rows"][number],
  index: number,
  backfillRowIndex: number | null,
  guideMode: boolean
): string {
  if (backfillRowIndex === index) return "#e8d5c4";
  if (guideMode) {
    switch (row.guideStatus) {
      case "done":
        return "#d4edda";
      case "laid_ww_pending":
        return "#fff3cd";
      case "not_laid":
        return "#f8d7da";
      case "off_guide":
        return "#ffe8cc";
      default:
        break;
    }
  }
  if (row.pending) return "#fff3cd";
  return "#ffffff";
}

export function buildWeldWrapHtml(data: WeldWrapReportData, logoSrc: string): string {
  const { section, summary, rows, generatedAtLabel, sectionContext, filterLabel, guideMode } =
    data;
  const backfillRowIndex = findClosestChainageRowIndex(
    rows,
    sectionContext?.backfillUpTo ?? null
  );
  const statusCol = guideMode
    ? `<th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">Status</th>`
    : "";
  const detailRows = rows
    .map(
      (row, index) => `
    <tr style="background:${detailRowBackground(row, index, backfillRowIndex, !!guideMode)};">
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${row.guideSequence ?? row.counter ?? "—"}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${row.chainage ?? "—"}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${esc(row.pipe_fitting_id ?? "—")}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${esc(row.jointTypeLabel)}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${esc(row.weldedLabel)}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${esc(row.wrappedLabel)}</td>
      ${
        guideMode
          ? `<td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${esc(guideStatusLabel(row))}</td>`
          : ""
      }
      <td style="padding:6px 8px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;">${esc(row.comments ?? "—")}</td>
    </tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Weld &amp; Wrap Status — ${esc(section.name ?? "Section")}</title>
</head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;color:#222;">
  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
    <tr>
      <td style="vertical-align:middle;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#1a5276;">Weld &amp; Wrap Status Report</h1>
        <p style="margin:0;font-size:13px;color:#555;">Generated ${esc(generatedAtLabel)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#555;"><strong>Showing:</strong> ${esc(filterLabel)}</p>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <img src="${logoSrc}" alt="readX" width="80" style="display:block;margin-left:auto;" />
      </td>
    </tr>
  </table>

  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;font-family:Arial,sans-serif;font-size:12px;">
    <tr><td style="padding:4px 0;"><strong>Section:</strong> ${esc(section.name ?? "—")}</td></tr>
    <tr><td style="padding:4px 0;"><strong>ITP:</strong> ${esc(section.itp_number ?? "—")}</td></tr>
    <tr><td style="padding:4px 0;"><strong>Project:</strong> ${esc(projectLabel(section))}</td></tr>
  </table>

  <h2 style="margin:0 0 12px;font-size:14px;color:#1a5276;">Summary</h2>
  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
    <tr style="background:#eee4da;">
      <th style="padding:8px;border:1px solid #ccc;text-align:left;width:33%;">WR Welds</th>
      <th style="padding:8px;border:1px solid #ccc;text-align:left;width:33%;">WB Welds</th>
      <th style="padding:8px;border:1px solid #ccc;text-align:left;width:34%;">Wraps</th>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #ccc;vertical-align:top;">
        <div><strong>Done:</strong> ${summary.wrWeldsDone}</div>
        <div><strong>Pending:</strong> ${summary.wrWeldsPending}</div>
        <div style="margin-top:4px;color:#555;"><strong>Total:</strong> ${summary.wrWeldsDone + summary.wrWeldsPending}</div>
      </td>
      <td style="padding:8px;border:1px solid #ccc;vertical-align:top;">
        <div><strong>Done:</strong> ${summary.wbWeldsDone}</div>
        <div><strong>Pending:</strong> ${summary.wbWeldsPending}</div>
        <div style="margin-top:4px;color:#555;"><strong>Total:</strong> ${summary.wbWeldsDone + summary.wbWeldsPending}</div>
      </td>
      <td style="padding:8px;border:1px solid #ccc;vertical-align:top;">
        <div><strong>Done:</strong> ${summary.wrapsDone}</div>
        <div><strong>Pending:</strong> ${summary.wrapsPending}</div>
        <div style="margin-top:4px;color:#555;"><strong>Total:</strong> ${summary.wrapsDone + summary.wrapsPending}</div>
      </td>
    </tr>
  </table>

  <h2 style="margin:0 0 12px;font-size:14px;color:#1a5276;">Detail</h2>
  <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:10px;color:#666;">
    ${
      guideMode
        ? "Green = done · Yellow = laid, W/W pending · Red = not laid · Orange = off-guide."
        : `Tan row = joint nearest to backfill position (CH ${sectionContext?.backfillUpTo != null ? sectionContext.backfillUpTo.toLocaleString("en-AU") : "—"}). Yellow row = pending weld or wrap.`
    }
  </p>

  <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:Arial,sans-serif;">
    <thead>
      <tr style="background:#eee4da;">
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">${guideMode ? "Seq" : "#"}</th>
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">CH</th>
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">Pipe/Fitting ID</th>
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">Joint</th>
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">Welded</th>
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">Wrapped</th>
        ${statusCol}
        <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;text-align:left;">Comments</th>
      </tr>
    </thead>
    <tbody>
      ${
        detailRows ||
        `<tr><td colspan="${guideMode ? 8 : 7}" style="padding:12px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:11px;text-align:center;color:#666;">No records.</td></tr>`
      }
    </tbody>
  </table>
</body>
</html>`;
}
