"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getITRProgress } from "@/lib/drainer";
import type { PipeRecord } from "./record-edit-form";

type SectionChProgress = {
  endCh: number | null;
  progressPercent: number;
  configured: boolean;
  hasRecords: boolean;
  installedCount?: number;
  minItrRequired?: number | null;
  totalRecordSlots?: number | null;
};

type SectionProgressBarProps = {
  sectionId: string;
  getAccessToken: () => Promise<string | null>;
  refreshTrigger?: number; // increment to refetch (e.g. after record edit)
  installedCount: number;
  guideEnabled?: boolean;
  guideXml?: { sequence_number: number; item_id: string }[] | null;
};

export function SectionProgressBar({
  sectionId,
  getAccessToken,
  refreshTrigger,
  installedCount,
  guideEnabled,
  guideXml,
}: SectionProgressBarProps) {
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

  const hasGuideProgress =
    guideEnabled === true && Array.isArray(guideXml) && guideXml.length > 0;
  const guideTotalItems = hasGuideProgress ? guideXml.length : 0;
  const guidePercent =
    hasGuideProgress && guideTotalItems > 0
      ? Math.round((installedCount / guideTotalItems) * 100)
      : 0;

  const label = hasGuideProgress
    ? `${installedCount} / ${guideTotalItems} items · ${guidePercent}%`
    : progress?.configured
    ? progress.minItrRequired != null && progress.totalRecordSlots != null
      ? progress.hasRecords
        ? `${installedCount} / ${progress.totalRecordSlots} records (${progress.minItrRequired} ITR min) · ${progress.progressPercent}%`
        : `0 / ${progress.totalRecordSlots} records (${progress.minItrRequired} ITR min) · 0%`
      : progress?.hasRecords
        ? `${installedCount} records · ${progress.progressPercent}%`
        : "No records yet"
    : progress
      ? "Configure section CH to see progress"
      : "Loading…";
  const percent = hasGuideProgress
    ? guidePercent
    : progress?.configured
      ? progress.progressPercent
      : 0;

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
  totalInstalledCount?: number;
  onEditRecord: (id: string) => void;
  getAccessToken: () => Promise<string | null>;
  emptyMessage?: string;
  progressRefreshTrigger?: number;
  selectedSection?: {
    guide_enabled?: boolean;
    guide_xml?: { sequence_number: number; item_id: string }[] | null;
  } | null;
  sectionOptions?: { id: string; name: string }[];
  onSectionChange?: (sectionId: string) => void;
  onRefresh?: () => void | Promise<void>;
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

function formatTimeFromTimestamp(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return "—";
    const hrs = date.getHours();
    const mins = date.getMinutes();
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

function formatLodgedTime(r: PipeRecord) {
  const fromLodged = formatTimeFromTimestamp(r.lodged_at);
  if (fromLodged !== "—") return fromLodged;
  const fromUpdated = formatTimeFromTimestamp(r.updated_at);
  if (fromUpdated !== "—") return fromUpdated;
  return formatTime(r.date_installed, r.time_installed);
}

function recordLodgedTimestamp(r: PipeRecord): number {
  for (const ts of [r.lodged_at, r.updated_at, r.date_installed]) {
    if (!ts) continue;
    const t = new Date(ts).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function formatEditedTime(r: PipeRecord) {
  const edited = formatTimeFromTimestamp(r.updated_at);
  if (edited === "—") return "—";
  if (r.lodged_at && r.updated_at && r.lodged_at === r.updated_at) return "—";
  return edited;
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
  totalInstalledCount,
  onEditRecord,
  getAccessToken,
  emptyMessage = "No records yet",
  progressRefreshTrigger,
  selectedSection,
  sectionOptions = [],
  onSectionChange,
  onRefresh,
}: SectionRecordsProps) {
  const [refreshing, setRefreshing] = useState(false);
  const itrProgress = useMemo(() => getITRProgress(records.length), [records.length]);
  const installedCount = totalInstalledCount ?? records.length;
  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => recordLodgedTimestamp(b) - recordLodgedTimestamp(a)
      ),
    [records]
  );

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="drainer-card resize-y overflow-y-auto overflow-x-hidden min-h-[420px] max-h-[90vh] min-w-0 max-w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="drainer-title">{sectionName} — Records</CardTitle>
        {onRefresh ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh records"
            aria-label="Refresh records"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 flex flex-col min-h-0 min-w-0">
        {sectionOptions.length > 0 && onSectionChange ? (
          <div className="w-full max-w-xs">
            <Select value={sectionId} onValueChange={onSectionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {sectionOptions.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

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

        <SectionProgressBar
          sectionId={sectionId}
          getAccessToken={getAccessToken}
          refreshTrigger={progressRefreshTrigger}
          installedCount={installedCount}
          guideEnabled={selectedSection?.guide_enabled}
          guideXml={selectedSection?.guide_xml ?? null}
        />

        <div className="border border-[var(--border)] rounded-lg bg-[#E8D2BF] flex-1 min-h-0 min-w-0 max-w-full">
          <div className="min-h-[220px] max-h-[min(360px,45vh)] max-w-full overflow-y-auto overflow-x-scroll drainer-scrollbar">
            <div className="inline-block min-w-full w-max">
            <table className="text-sm min-w-[720px] font-[var(--font-body)]">
              <thead className="bg-[#EEE4DA] sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Time (lodged)</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Edited time</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">CH</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Pipe ID</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Joint</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-[var(--muted-foreground)]">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--surface-alt)]/50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date_installed)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatLodgedTime(r)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatEditedTime(r)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.chainage}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{r.pipe_fitting_id ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.joint_type ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
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
        </div>
      </CardContent>
    </Card>
  );
}
