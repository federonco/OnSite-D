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
}: {
  sectionId: string;
  refreshTrigger?: number;
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
      const res = await fetch(`/api/drainer/records?sectionId=${sectionId}&limit=3`);
      const data = await res.json();
      setRecords((data.records ?? []).slice(0, 3));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  if (!sectionId) return null;

  return (
    <Card className="drainer-card">
      <CardContent className="pt-4">
        <div className="drainer-title text-sm">Last 3 pipes lodged</div>
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
                <span className="font-mono text-xs drainer-nums-plain-zero">
                  Ch {r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </span>
                <span className="font-mono text-xs truncate max-w-[140px]" title={r.pipe_fitting_id ?? ""}>
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
