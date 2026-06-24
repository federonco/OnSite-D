import type { WeldWrapReportData } from "./types";
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
      return "Not laid";
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
    ${
      sectionContext?.backfillUpTo != null
        ? `<tr><td style="padding:4px 0;"><strong>Backfill up to:</strong> CH ${sectionContext.backfillUpTo.toLocaleString("en-AU")}</td></tr>`
        : `<tr><td style="padding:4px 0;"><strong>Backfill up to:</strong> —</td></tr>`
    }
  </table>

  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
    <tr style="background:#eee4da;">
      <th colspan="2" style="padding:8px;border:1px solid #ccc;text-align:left;">Welds (WR + Transition)</th>
      <th colspan="2" style="padding:8px;border:1px solid #ccc;text-align:left;">Welds (WB)</th>
      <th colspan="2" style="padding:8px;border:1px solid #ccc;text-align:left;">Wrap</th>
    </tr>
    <tr>
      <td style="padding:6px 8px;border:1px solid #ccc;">Done</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.wrWeldsDone}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;">Done</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.wbWeldsDone}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;">Done</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.wrapsDone}</td>
    </tr>
    <tr>
      <td style="padding:6px 8px;border:1px solid #ccc;">Pending</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.wrWeldsPending}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;">Pending</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.wbWeldsPending}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;">Pending</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.wrapsPending}</td>
    </tr>
  </table>

  ${
    guideMode && summary.guideDone != null
      ? `<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
    <tr style="background:#eee4da;">
      <th colspan="4" style="padding:8px;border:1px solid #ccc;text-align:left;">Installation guide</th>
    </tr>
    <tr>
      <td style="padding:6px 8px;border:1px solid #ccc;">Done</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.guideDone ?? 0}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;">Laid, W/W pending</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.guideLaidPending ?? 0}</td>
    </tr>
    <tr>
      <td style="padding:6px 8px;border:1px solid #ccc;">Not laid</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.guideNotLaid ?? 0}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;">Off-guide</td>
      <td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${summary.guideOffGuide ?? 0}</td>
    </tr>
  </table>`
      : ""
  }

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
