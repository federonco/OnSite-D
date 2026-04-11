"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

type PipeRecord = {
  id: string;
  chainage: number;
  pipe_fitting_id: string | null;
  joint_type: string | null;
  date_installed: string | null;
};

export function LastPipesView({
  sectionId,
  refreshTrigger,
  qrToken,
}: {
  sectionId: string;
  refreshTrigger?: number;
  /** When set (e.g. /enter?token=…), sent so the API can authorize without login. */
  qrToken?: string | null;
}) {
  const [records, setRecords] = useState<PipeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        sectionId,
        limit: "3",
      });
      if (qrToken?.trim()) {
        qs.set("qr_token", qrToken.trim());
      }
      const res = await fetch(`/api/drainer/records?${qs.toString()}`);
      const data = await res.json();
      const list = (data.records ?? []).slice(0, 3);
      list.sort((a: PipeRecord, b: PipeRecord) => Number(a.chainage) - Number(b.chainage));
      setRecords(list);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId, qrToken]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  if (!sectionId) return null;

  return (
    <Card className="drainer-card">
      <CardContent className="pt-0">
        <div className="drainer-title">Last 3 records lodged</div>
        {loading ? (
          <p className="text-xs text-[var(--muted-foreground)] mt-2">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] mt-2">No records yet</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex justify-between items-center text-sm py-1 border-b border-[var(--border)] last:border-0"
              >
                <span className="text-xs drainer-nums-plain-zero">
                  Ch {r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs truncate max-w-[140px]" title={r.pipe_fitting_id ?? ""}>
                  {r.pipe_fitting_id ?? "—"}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">{r.joint_type ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
