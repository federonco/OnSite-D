"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getITRProgress } from "@/lib/drainer";
import type { PipeRecord } from "./record-edit-form";

type SectionRecordsProps = {
  sectionName: string;
  records: PipeRecord[];
  onEditRecord: (id: string) => void;
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

function formatAlignment(r: PipeRecord) {
  const vSign = r.deflection_v_sign ?? "+";
  const vMm = r.deflection_v_mm ?? 0;
  const hSide = r.deflection_h_side ?? "L";
  const hMm = r.deflection_h_mm ?? 0;
  return `V: ${vSign}${vMm}mm / H: ${hSide}${hMm}mm`;
}

export function SectionRecords({
  sectionName,
  records,
  onEditRecord,
}: SectionRecordsProps) {
  const progress = useMemo(() => getITRProgress(records.length), [records.length]);

  return (
    <Card className="drainer-card">
      <CardHeader>
        <CardTitle className="drainer-title">{sectionName} — Records</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">
            Total complete ITRs: {progress.completeITRs}
          </Badge>
          <Badge variant="outline">
            Current open: {progress.currentOpenCount} / {progress.currentOpenTotal} records
          </Badge>
        </div>

        <div>
          <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-1">
            <span>ITR progress</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-[var(--surface-alt)] sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">CH</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Pipe ID</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Joint</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Inspector</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-[var(--muted-foreground)]">
                      No records yet
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--surface-alt)]/50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date_installed)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.chainage}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.pipe_fitting_id ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.joint_type ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.inspector_name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px]"
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
