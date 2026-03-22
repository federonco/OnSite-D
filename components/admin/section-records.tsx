"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getITRProgress } from "@/lib/drainer";
import type { PipeRecord } from "./record-edit-form";

type SectionChProgress = {
  currentCh: number | null;
  endCh: number | null;
  progressPercent: number;
  configured: boolean;
  hasRecords: boolean;
};

type SectionProgressBarProps = {
  sectionId: string;
  getAccessToken: () => Promise<string | null>;
  refreshTrigger?: number; // increment to refetch (e.g. after record edit)
};

export function SectionProgressBar({ sectionId, getAccessToken, refreshTrigger }: SectionProgressBarProps) {
  const [progress, setProgress] = useState<SectionChProgress | null>(null);

  useEffect(() => {
    if (!sectionId) return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      const res = await fetch(`/api/drainer/sections/${sectionId}/progress`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      const data = await res.json();
      if (!cancelled && res.ok) setProgress(data);
      else if (!cancelled) setProgress(null);
    })();
    return () => { cancelled = true; };
  }, [sectionId, getAccessToken, refreshTrigger]);

  const label = progress?.configured
    ? progress?.hasRecords
      ? `CH ${(progress.currentCh ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })} → ${(progress.endCh ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })} · ${progress.progressPercent}%`
      : "No records yet"
    : progress
      ? "Configure section CH to see progress"
      : "Loading…";
  const percent = progress?.configured && progress?.hasRecords ? progress.progressPercent : 0;

  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-1">
        <span>Section Progress</span>
        <span>{label}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
        <div
          className="h-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

type SectionRecordsProps = {
  sectionName: string;
  sectionId: string;
  records: PipeRecord[];
  onEditRecord: (id: string) => void;
  getAccessToken: () => Promise<string | null>;
  emptyMessage?: string;
  progressRefreshTrigger?: number;
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatTime(d: string | null, t: string | null) {
  if (t) return t;
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    const hrs = date.getHours();
    const mins = date.getMinutes();
    if (hrs === 0 && mins === 0) return "—";
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

function formatAlignment(r: PipeRecord) {
  const vSign = r.deflection_v_sign ?? "+";
  const vMm = r.deflection_v_mm ?? 0;
  const hSide = r.deflection_h_side ?? "L";
  const hMm = r.deflection_h_mm ?? 0;
  return `V: ${vSign}${vMm}mm / H: ${hSide}${hMm}mm`;
}

export function SectionRecords({
  sectionName,
  sectionId,
  records,
  onEditRecord,
  getAccessToken,
  emptyMessage = "No records yet",
  progressRefreshTrigger,
}: SectionRecordsProps) {
  const itrProgress = useMemo(() => getITRProgress(records.length), [records.length]);

  return (
    <Card className="drainer-card">
      <CardHeader>
        <CardTitle className="drainer-title">{sectionName} — Records</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="drainer-badge-ready">
            <span className="drainer-badge-ready-dot" aria-hidden />
            Total complete ITRs: {itrProgress.completeITRs}
          </span>
          <span className="drainer-badge-open">
            <span className="drainer-badge-open-dot" aria-hidden />
            Current open: {itrProgress.currentOpenCount} / {itrProgress.currentOpenTotal} records
          </span>
        </div>

        <SectionProgressBar sectionId={sectionId} getAccessToken={getAccessToken} refreshTrigger={progressRefreshTrigger} />

        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[#E8D2BF]">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm min-w-[400px] font-[var(--font-body)]">
              <thead className="bg-[#EEE4DA] sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Time</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">CH</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Pipe ID</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Joint</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-[var(--muted-foreground)]">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--surface-alt)]/50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date_installed)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatTime(r.date_installed, r.time_installed)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.chainage}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{r.pipe_fitting_id ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.joint_type ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px] bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
                          onClick={() => onEditRecord(r.id)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
