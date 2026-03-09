"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AdminNav } from "@/components/admin-nav";
import { RecordEditForm } from "@/components/admin/record-edit-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";

type MissedCheckpoint = {
  id: string;
  name: string;
  ch: number;
  detected_at_ch: number;
};

type InconsistencyItem = {
  ch_from: number;
  ch_to: number;
  diff: number;
  type: "gap" | "overlap";
  record_from_id: string;
  record_to_id: string;
  record_from_counter: number | null;
  record_from_fitting_id: string;
  record_to_fitting_id: string;
  inferred_type_from: "pipe" | "fitting";
  inferred_type_to: "pipe" | "fitting";
};

type SectionInconsistencies = {
  section_id: string;
  section_name?: string;
  total_records: number;
  max_ch: number | null;
  inconsistencies: InconsistencyItem[];
};

type DuplicateGroup = {
  pipe_fitting_id: string;
  count: number;
  records: { id: string; counter: number | null; chainage: number; date_installed: string | null }[];
};
type DuplicatesSection = { section_id: string; section_name?: string; duplicates: DuplicateGroup[] };

type NearToleranceRecord = {
  id: string;
  counter: number | null;
  chainage: number;
  pipe_fitting_id: string | null;
  deflection_v_sign: string | null;
  deflection_v_mm: number | null;
  deflection_h_side: string | null;
  deflection_h_mm: number | null;
  level: "warning" | "critical";
};
type NearToleranceSection = { section_id: string; section_name?: string; records: NearToleranceRecord[] };

type DeflectionTrendRecord = {
  counter: number | null;
  chainage: number;
  deflection_v_sign?: string | null;
  deflection_v_mm?: number | null;
  deflection_h_side?: string | null;
  deflection_h_mm?: number | null;
};
type DeflectionTrendEntry = {
  type: "vertical" | "horizontal";
  direction: string;
  records: DeflectionTrendRecord[];
  avg_mm: number;
  first_record_id?: string;
  first_record_counter?: number | null;
};
type DeflectionTrendSection = { section_id: string; section_name?: string; trends: DeflectionTrendEntry[] };

export default function NotificationsPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [missed, setMissed] = useState<MissedCheckpoint[]>([]);
  const [sectionData, setSectionData] = useState<SectionInconsistencies[]>([]);
  const [inconsistenciesLoading, setInconsistenciesLoading] = useState(true);
  const [duplicatesData, setDuplicatesData] = useState<DuplicatesSection[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [nearToleranceData, setNearToleranceData] = useState<NearToleranceSection[]>([]);
  const [nearToleranceLoading, setNearToleranceLoading] = useState(false);
  const [deflectionTrendData, setDeflectionTrendData] = useState<DeflectionTrendSection[]>([]);
  const [deflectionTrendLoading, setDeflectionTrendLoading] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [nearOpen, setNearOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editContextualNote, setEditContextualNote] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    recordId: string;
    counter: number | null;
    chainage: number;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadMissed = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/drainer/checkpoints/missed", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (data.missed) setMissed(data.missed);
  }, [getAccessToken]);

  const loadInconsistencies = useCallback(async () => {
    const token = await getAccessToken();
    setInconsistenciesLoading(true);
    try {
      const res = await fetch("/api/drainer/records/inconsistencies", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.sections) setSectionData(data.sections);
      else if (data.section_id) setSectionData([data]);
      else setSectionData([]);
    } finally {
      setInconsistenciesLoading(false);
    }
  }, [getAccessToken]);

  const loadDuplicates = useCallback(async () => {
    const token = await getAccessToken();
    setDuplicatesLoading(true);
    try {
      const res = await fetch("/api/drainer/records/duplicates", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const sections: DuplicatesSection[] = data.sections ?? (data.duplicates ? [{ section_id: data.section_id ?? "", section_name: data.section_name, duplicates: data.duplicates }] : []);
      setDuplicatesData(sections);
      const total = sections.reduce((s, sec) => s + (sec.duplicates?.length ?? 0), 0);
      setDupOpen(total > 0);
    } finally {
      setDuplicatesLoading(false);
    }
  }, [getAccessToken]);

  const loadNearTolerance = useCallback(async () => {
    const token = await getAccessToken();
    setNearToleranceLoading(true);
    try {
      const res = await fetch("/api/drainer/records/near-tolerance", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const sections: NearToleranceSection[] = data.sections ?? (data.records ? [{ section_id: data.section_id ?? "", section_name: data.section_name, records: data.records }] : []);
      setNearToleranceData(sections);
      const total = sections.reduce((s, sec) => s + (sec.records?.length ?? 0), 0);
      setNearOpen(total > 0);
    } finally {
      setNearToleranceLoading(false);
    }
  }, [getAccessToken]);

  const loadDeflectionTrend = useCallback(async () => {
    const token = await getAccessToken();
    setDeflectionTrendLoading(true);
    try {
      const res = await fetch("/api/drainer/records/deflection-trend", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const sections: DeflectionTrendSection[] = data.sections ?? (data.trends ? [{ section_id: data.section_id ?? "", section_name: data.section_name, trends: data.trends }] : []);
      setDeflectionTrendData(sections);
      const total = sections.reduce((s, sec) => s + (sec.trends?.length ?? 0), 0);
      setTrendOpen(total > 0);
    } finally {
      setDeflectionTrendLoading(false);
    }
  }, [getAccessToken]);

  const loadAllValidation = useCallback(() => {
    loadInconsistencies();
    loadDuplicates();
    loadNearTolerance();
    loadDeflectionTrend();
  }, [loadInconsistencies, loadDuplicates, loadNearTolerance, loadDeflectionTrend]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthEmail(data.session?.user.email ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!authEmail) return;
    const check = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/drainer/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      setIsAdmin(json.isAdmin ?? false);
      if (json.isAdmin) {
        loadMissed();
        loadInconsistencies();
        loadDuplicates();
        loadNearTolerance();
        loadDeflectionTrend();
      }
    };
    check();
  }, [authEmail, getAccessToken, loadMissed, loadInconsistencies, loadDuplicates, loadNearTolerance, loadDeflectionTrend]);

  const openViewRecord = (inc: InconsistencyItem) => {
    const note =
      inc.type === "gap"
        ? `Possible missing record between CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} and CH ${inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })}. A fitting or pipe may not have been lodged.`
        : `Possible duplicate or incorrect chainage entry near CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })}.`;
    setEditContextualNote(note);
    setEditRecordId(inc.record_from_id);
    setEditOpen(true);
  };

  const openViewRecordById = (recordId: string, note?: string | null) => {
    setEditContextualNote(note ?? null);
    setEditRecordId(recordId);
    setEditOpen(true);
  };

  const openDeleteConfirm = (inc: InconsistencyItem) => {
    setDeleteConfirm({
      recordId: inc.record_from_id,
      counter: inc.record_from_counter,
      chainage: inc.ch_from,
    });
  };

  const handleDeleteRecord = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/records/${deleteConfirm.recordId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      pushToast({ type: "success", title: "Record deleted" });
      setDeleteConfirm(null);
      loadAllValidation();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const allInconsistencies = sectionData.flatMap((sec) =>
    sec.inconsistencies.map((inc) => ({ inc, sec }))
  );
  const hasInconsistencies = allInconsistencies.length > 0;

  if (authEmail === null || isAdmin === null) {
    return (
      <div className="drainer-page">
        <div className="drainer-shell">
          <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authEmail || !isAdmin) {
    return (
      <div className="drainer-page">
        <div className="drainer-shell">
          <h1 className="drainer-title text-xl">Notifications</h1>
          <AuthPanel onAuthChange={setAuthEmail} />
          <p className="text-sm text-[var(--muted-foreground)] mt-4">
            {!authEmail ? "Sign in to access." : "Access denied."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="drainer-page">
      <div className="drainer-shell max-w-5xl">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="drainer-title text-xl">Notifications</h1>
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                Back to Admin
              </Button>
            </Link>
          </div>
          <AuthPanel onAuthChange={setAuthEmail} />
        </div>

        <AdminNav />

        <Card className="drainer-card">
          <CardContent className="pt-0">
            <div className="flex items-start justify-between gap-4">
              <div className="drainer-title">Data validation</div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]"
                onClick={loadAllValidation}
                disabled={inconsistenciesLoading || duplicatesLoading || nearToleranceLoading || deflectionTrendLoading}
                title="Refresh"
              >
                {inconsistenciesLoading || duplicatesLoading || nearToleranceLoading || deflectionTrendLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </div>
            <div className="mt-4">
            {inconsistenciesLoading ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4">
                Loading…
              </p>
            ) : !hasInconsistencies ? (
              <p className="text-sm text-green-600 py-4">
                ✅ No inconsistencies detected
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allInconsistencies.map(({ inc, sec }, idx) => (
                  <div
                    key={`${sec.section_id}-${idx}`}
                    className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={inc.type === "gap" ? "text-[var(--danger)] font-medium" : "text-[var(--warning)] font-medium"}>{inc.type === "gap" ? "Gap" : "Overlap"}</span>
                      <span className="text-sm font-medium">Record #{inc.record_from_counter ?? "—"}</span>
                    </div>
                    <p className="text-sm mb-2">
                      CH {inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} → {inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })} · <span className={inc.type === "gap" ? "text-[var(--danger)] font-medium" : "text-[var(--warning)] font-medium"}>{inc.diff.toLocaleString("en-AU", { minimumFractionDigits: 1 })}m</span>
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mb-3">
                      {inc.type === "gap" ? "Possible missing record between these chainages." : "Possible duplicate or incorrect chainage entry."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="min-h-[44px] flex-1 md:flex-initial" onClick={() => openViewRecord(inc)}>
                        View Record
                      </Button>
                      <Button variant="outline" size="sm" className="min-h-[44px] flex-1 md:flex-initial" onClick={() => openDeleteConfirm(inc)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* CHECK 1 — Duplicate Pipe ID */}
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left font-medium text-sm"
                onClick={() => setDupOpen((o) => !o)}
              >
                <span>{dupOpen ? "▼" : "▶"}</span>
                <span>Duplicated pipe IDs</span>
                {!duplicatesLoading && (
                  <Badge variant="secondary" className="text-xs">
                    {duplicatesData.reduce((s, sec) => s + (sec.duplicates?.length ?? 0), 0)}
                  </Badge>
                )}
              </button>
              {dupOpen && (
                <div className="mt-2">
                  {duplicatesLoading ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">Loading…</p>
                  ) : duplicatesData.reduce((s, sec) => s + (sec.duplicates?.length ?? 0), 0) === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">No duplicate pipe IDs found</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {duplicatesData.flatMap((sec) =>
                        (sec.duplicates ?? []).map((dup, idx) => (
                          <div key={`${sec.section_id}-${dup.pipe_fitting_id}-${idx}`} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">⚠️ Duplicate</Badge>
                                <span className="font-mono font-bold">{dup.pipe_fitting_id}</span>
                              </div>
                              {duplicatesData.length > 1 && <span className="text-xs text-[var(--muted-foreground)]">{sec.section_name ?? sec.section_id}</span>}
                            </div>
                            <p className="text-sm text-[var(--muted-foreground)] mb-3">
                              {dup.count} occurrences · {dup.records.map((r) => `CH ${r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`).join(", ")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {dup.records.map((r) => (
                                <Button key={r.id} variant="outline" size="sm" className="min-h-[44px]" onClick={() => openViewRecordById(r.id, `Duplicate pipe ID: ${dup.pipe_fitting_id}`)}>
                                  View #{r.counter ?? "?"}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CHECK 2 — Near-Tolerance Deflection */}
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left font-medium text-sm"
                onClick={() => setNearOpen((o) => !o)}
              >
                <span>{nearOpen ? "▼" : "▶"}</span>
                <span>Near-tolerance deflections</span>
                {!nearToleranceLoading && (
                  <Badge variant="secondary" className="text-xs">
                    {nearToleranceData.reduce((s, sec) => s + (sec.records?.length ?? 0), 0)}
                  </Badge>
                )}
              </button>
              {nearOpen && (
                <div className="mt-2">
                  {nearToleranceLoading ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">Loading…</p>
                  ) : nearToleranceData.reduce((s, sec) => s + (sec.records?.length ?? 0), 0) === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">All deflections within safe range</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {nearToleranceData.flatMap((sec) =>
                        (sec.records ?? []).map((r) => (
                          <div key={r.id} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className={r.level === "critical" ? "text-[var(--danger)] font-medium" : "text-[var(--warning)] font-medium"}>
                                {r.level === "critical" ? "Critical" : "Warning"}
                              </span>
                              <span className="text-sm font-medium">Record #{r.counter ?? "—"}</span>
                            </div>
                            <p className="text-sm mb-1">CH {r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })} · {r.pipe_fitting_id ?? "—"}</p>
                            <p className="text-sm mb-2">V: {(r.deflection_v_sign ?? "+")}{Math.abs(r.deflection_v_mm ?? 0)}mm  H: {(r.deflection_h_side ?? "L")}{Math.abs(r.deflection_h_mm ?? 0)}mm</p>
                            <p className="text-xs text-[var(--muted-foreground)] mb-3">
                              {r.level === "critical"
                                ? "Deflection approaching limit. Review installation before next ITR."
                                : "Deflection within range but elevated. Monitor next records."}
                            </p>
                            <Button variant="outline" size="sm" className="min-h-[44px] w-full md:w-auto" onClick={() => openViewRecordById(r.id, r.level === "critical" ? "Deflection approaching limit. Review installation before next ITR." : "Deflection within range but elevated. Monitor next records.")}>
                              View Record
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CHECK 3 — Deflection Trend */}
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left font-medium text-sm"
                onClick={() => setTrendOpen((o) => !o)}
              >
                <span>{trendOpen ? "▼" : "▶"}</span>
                <span>Deflection trends</span>
                {!deflectionTrendLoading && (
                  <Badge variant="secondary" className="text-xs">
                    {deflectionTrendData.reduce((s, sec) => s + (sec.trends?.length ?? 0), 0)}
                  </Badge>
                )}
              </button>
              {trendOpen && (
                <div className="mt-2">
                  {deflectionTrendLoading ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">Loading…</p>
                  ) : deflectionTrendData.reduce((s, sec) => s + (sec.trends?.length ?? 0), 0) === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">No deflection trends detected</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {deflectionTrendData.flatMap((sec) =>
                        (sec.trends ?? []).map((t, idx) => {
                          const chMin = Math.min(...t.records.map((r) => r.chainage));
                          const chMax = Math.max(...t.records.map((r) => r.chainage));
                          const formatRec = (r: DeflectionTrendRecord) => {
                            if (t.type === "vertical") {
                              const v = `${r.deflection_v_sign ?? "+"}${Math.abs(r.deflection_v_mm ?? 0)}mm`;
                              return `#${r.counter ?? "?"} CH ${r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })} (${v})`;
                            }
                            const h = `${r.deflection_h_side ?? "L"}${Math.abs(r.deflection_h_mm ?? 0)}mm`;
                            return `#${r.counter ?? "?"} CH ${r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })} (${h})`;
                          };
                          return (
                            <div key={`${sec.section_id}-${t.type}-${idx}`} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">📈 Trend</Badge>
                                  <span className="text-sm font-medium capitalize">{t.type} — {t.direction}</span>
                                </div>
                                {deflectionTrendData.length > 1 && <span className="text-xs text-[var(--muted-foreground)]">{sec.section_name ?? sec.section_id}</span>}
                              </div>
                              <p className="text-sm mb-2">
                                CH {chMin.toLocaleString("en-AU", { minimumFractionDigits: 2 })} → CH {chMax.toLocaleString("en-AU", { minimumFractionDigits: 2 })} · Avg: {t.avg_mm}mm
                              </p>
                              <p className="text-xs text-[var(--muted-foreground)] mb-2">
                                4 consecutive records accumulating deflection in the same direction. Possible alignment issue in trench.
                              </p>
                              <ul className="text-xs text-[var(--muted-foreground)] list-disc list-inside mb-3 space-y-0.5">
                                {t.records.map((r, i) => (
                                  <li key={i}>{formatRec(r)}</li>
                                ))}
                              </ul>
                              {t.first_record_id && (
                                <Button variant="outline" size="sm" className="min-h-[44px] w-full" onClick={() => openViewRecordById(t.first_record_id!, "Deflection trend — 4 consecutive records in same direction. Possible alignment issue in trench.")}>
                                  View Record #{t.first_record_counter ?? "?"}
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          </CardContent>
        </Card>

        <Card className="drainer-card">
          <CardContent className="pt-0">
            <div className="flex items-start justify-between gap-4">
              <div className="drainer-title">Missed checkpoint alerts</div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]"
                onClick={loadMissed}
                title="Refresh"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <div className="mt-4">
            <p className="text-xs text-[var(--muted-foreground)] mb-3">
              Active checkpoints that did not trigger an alert because the
              current CH already passed the point.
            </p>
            {missed.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                No missed alerts.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[280px]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2 whitespace-nowrap">Name</th>
                      <th className="text-left py-2 px-2 whitespace-nowrap">Checkpoint CH</th>
                      <th className="text-left py-2 px-2 whitespace-nowrap">CH when exceeded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missed.map((m) => (
                      <tr key={m.id} className="border-b border-[var(--border)]/50">
                        <td className="py-2 px-2 font-medium whitespace-nowrap">{m.name ? m.name.charAt(0).toUpperCase() + m.name.slice(1).toLowerCase() : ""}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{m.ch.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{m.detected_at_ch.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      </div>

      <RecordEditForm
        recordId={editRecordId}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditRecordId(null);
          setEditContextualNote(null);
        }}
        onSaved={loadAllValidation}
        getAccessToken={getAccessToken}
        contextualNote={editContextualNote}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">
            Delete record #{deleteConfirm?.counter ?? "?"} (CH {deleteConfirm?.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 }) ?? "?"})? This cannot be undone from the app.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRecord} disabled={deleteLoading} className="min-h-[44px]">
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
