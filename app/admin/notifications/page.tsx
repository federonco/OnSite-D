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

type FittingRecord = {
  id: string;
  counter: number | null;
  chainage: number;
  pipe_fitting_id: string | null;
  date_installed: string | null;
};
type FittingsSection = { section_id: string; section_name?: string; records: FittingRecord[] };

export default function NotificationsPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sectionData, setSectionData] = useState<SectionInconsistencies[]>([]);
  const [inconsistenciesLoading, setInconsistenciesLoading] = useState(true);
  const [duplicatesData, setDuplicatesData] = useState<DuplicatesSection[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [nearToleranceData, setNearToleranceData] = useState<NearToleranceSection[]>([]);
  const [nearToleranceLoading, setNearToleranceLoading] = useState(false);
  const [deflectionTrendData, setDeflectionTrendData] = useState<DeflectionTrendSection[]>([]);
  const [deflectionTrendLoading, setDeflectionTrendLoading] = useState(false);
  const [fittingsData, setFittingsData] = useState<FittingsSection[]>([]);
  const [fittingsLoading, setFittingsLoading] = useState(false);
  const [fittingsOpen, setFittingsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [nearOpen, setNearOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [validateFittingConfirm, setValidateFittingConfirm] = useState<{ sec: FittingsSection; r: FittingRecord } | null>(null);
  const [validatingFittingKey, setValidatingFittingKey] = useState<string | null>(null);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editContextualNote, setEditContextualNote] = useState<string | null>(null);
  const [editContextChFrom, setEditContextChFrom] = useState<number | null>(null);
  const [editContextChTo, setEditContextChTo] = useState<number | null>(null);
  const [editContextRecordToId, setEditContextRecordToId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    recordId: string;
    counter: number | null;
    chainage: number;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [validatingKey, setValidatingKey] = useState<string | null>(null);
  const [validateConfirm, setValidateConfirm] = useState<{
    sec: SectionInconsistencies;
    inc: InconsistencyItem;
  } | null>(null);
  const [validateNearConfirm, setValidateNearConfirm] = useState<{
    sec: NearToleranceSection;
    r: NearToleranceRecord;
  } | null>(null);
  const [validatingNearKey, setValidatingNearKey] = useState<string | null>(null);
  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

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

  const loadFittings = useCallback(async () => {
    const token = await getAccessToken();
    setFittingsLoading(true);
    try {
      const res = await fetch("/api/drainer/records/fittings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const sections: FittingsSection[] = data.sections ?? (data.records ? [{ section_id: data.section_id ?? "", section_name: data.section_name, records: data.records }] : []);
      setFittingsData(sections);
      const total = sections.reduce((s, sec) => s + (sec.records?.length ?? 0), 0);
      setFittingsOpen(total > 0);
    } finally {
      setFittingsLoading(false);
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
    loadFittings();
    loadDuplicates();
    loadNearTolerance();
    loadDeflectionTrend();
  }, [loadInconsistencies, loadFittings, loadDuplicates, loadNearTolerance, loadDeflectionTrend]);

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
        loadInconsistencies();
        loadFittings();
        loadDuplicates();
        loadNearTolerance();
        loadDeflectionTrend();
      }
    };
    check();
  }, [authEmail, getAccessToken, loadInconsistencies, loadFittings, loadDuplicates, loadNearTolerance, loadDeflectionTrend]);

  const openViewRecord = (inc: InconsistencyItem) => {
    const note =
      inc.type === "gap"
        ? `Possible missing record between CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} and CH ${inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })}. A fitting or pipe may not have been lodged.`
        : `Possible duplicate or incorrect chainage entry near CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })}.`;
    setEditContextualNote(note);
    setEditContextChFrom(inc.ch_from);
    setEditContextChTo(inc.ch_to);
    setEditContextRecordToId(inc.record_to_id);
    setEditRecordId(inc.record_from_id);
    setEditOpen(true);
  };

  const openViewRecordById = (
    recordId: string,
    note?: string | null,
    chFrom?: number | null,
    chTo?: number | null
  ) => {
    setEditContextualNote(note ?? null);
    setEditContextChFrom(chFrom ?? null);
    setEditContextChTo(chTo ?? null);
    setEditContextRecordToId(null);
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

  const handleValidateInconsistency = async (
    sec: SectionInconsistencies,
    inc: InconsistencyItem
  ) => {
    const key = `${sec.section_id}:${inc.record_from_id}:${inc.record_to_id}`;
    setValidatingKey(key);
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15000);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/records/inconsistencies/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: sec.section_id,
          record_from_id: inc.record_from_id,
          record_to_id: inc.record_to_id,
          issue_type: inc.type,
        }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      pushToast({ type: "success", title: "Issue validated" });
      setValidateConfirm(null);
      loadInconsistencies();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const isAbort = err instanceof Error && err.name === "AbortError";
      pushToast({
        type: "error",
        title: "Validation failed",
        message: isAbort ? "Request timed out. Please try again." : msg,
      });
    } finally {
      clearTimeout(timeout);
      setValidatingKey(null);
    }
  };

  const handleValidateFitting = async (sec: FittingsSection, r: FittingRecord) => {
    setValidatingFittingKey(r.id);
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15000);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/records/fittings/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ record_id: r.id }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      pushToast({ type: "success", title: "Fitting validated" });
      setValidateFittingConfirm(null);
      loadFittings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const isAbort = err instanceof Error && err.name === "AbortError";
      pushToast({
        type: "error",
        title: "Validation failed",
        message: isAbort ? "Request timed out. Please try again." : msg,
      });
    } finally {
      clearTimeout(timeout);
      setValidatingFittingKey(null);
    }
  };

  const handleValidateNearTolerance = async (
    sec: NearToleranceSection,
    r: NearToleranceRecord
  ) => {
    setValidatingNearKey(r.id);
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15000);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/records/near-tolerance/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ record_id: r.id }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      pushToast({ type: "success", title: "Near-tolerance validated" });
      setValidateNearConfirm(null);
      loadNearTolerance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const isAbort = err instanceof Error && err.name === "AbortError";
      pushToast({
        type: "error",
        title: "Validation failed",
        message: isAbort ? "Request timed out. Please try again." : msg,
      });
    } finally {
      clearTimeout(timeout);
      setValidatingNearKey(null);
    }
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
                disabled={inconsistenciesLoading || duplicatesLoading || nearToleranceLoading || deflectionTrendLoading || fittingsLoading}
                title="Refresh"
              >
                {inconsistenciesLoading || duplicatesLoading || nearToleranceLoading || deflectionTrendLoading || fittingsLoading ? (
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
                    className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm flex flex-col min-h-[180px]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {inc.type === "gap" ? (
                        <span className="drainer-badge-gap drainer-badge-gap-lg">Gap</span>
                      ) : (
                        <span className="drainer-badge-open drainer-badge-open-lg">Overlap</span>
                      )}
                      <span className="text-sm font-medium">Record #{inc.record_from_counter ?? "—"}</span>
                    </div>
                    <p className="text-sm mb-2">
                      CH {inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} → {inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })} · {inc.type === "gap" ? (
                        <span className="drainer-badge-gap">{inc.diff.toLocaleString("en-AU", { minimumFractionDigits: 1 })}m</span>
                      ) : (
                        <span className="drainer-badge-open">{inc.diff.toLocaleString("en-AU", { minimumFractionDigits: 1 })}m</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mb-3">
                      {inc.type === "gap" ? "Possible missing record between these chainages." : "Possible duplicate or incorrect chainage entry."}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 justify-between items-center w-full">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="min-h-[33px] h-[33px] px-3 text-xs bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] hover:bg-[var(--surface-alt)]" onClick={() => openDeleteConfirm(inc)}>
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[33px] h-[33px] px-3 text-xs bg-[#2F7D55] text-white border-0 hover:bg-[#267348] shrink-0"
                          onClick={() => setValidateConfirm({ sec, inc })}
                          disabled={validatingKey === `${sec.section_id}:${inc.record_from_id}:${inc.record_to_id}`}
                        >
                          {validatingKey === `${sec.section_id}:${inc.record_from_id}:${inc.record_to_id}` ? "Validating…" : "Validate"}
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" className="min-h-[33px] h-[33px] px-3 text-xs bg-[#B8682A] text-white border-0 hover:bg-[#A35D26] shrink-0" onClick={() => openViewRecord(inc)}>
                        View Record
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* CHECK 1 — Fittings (non-pipe pipe_fitting_id) */}
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left font-medium text-sm"
                onClick={() => setFittingsOpen((o) => !o)}
              >
                <span>{fittingsOpen ? "▼" : "▶"}</span>
                <span>Fittings (non-pipe names)</span>
                {!fittingsLoading && (
                  <Badge variant="secondary" className="text-xs">
                    {fittingsData.reduce((s, sec) => s + (sec.records?.length ?? 0), 0)}
                  </Badge>
                )}
              </button>
              {fittingsOpen && (
                <div className="mt-2">
                  {fittingsLoading ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">Loading…</p>
                  ) : fittingsData.reduce((s, sec) => s + (sec.records?.length ?? 0), 0) === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-2">No fittings to validate</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fittingsData.flatMap((sec) =>
                        (sec.records ?? []).map((r) => (
                          <div key={r.id} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm flex flex-col min-h-[140px]">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs">Fitting</Badge>
                              <span className="text-sm font-medium">Record #{r.counter ?? "—"}</span>
                            </div>
                            <p className="text-sm mb-1">CH {r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })} · <span className="font-mono">{r.pipe_fitting_id ?? "—"}</span></p>
                            <p className="text-xs text-[var(--muted-foreground)] mb-3">
                              Name differs from pipe format (000536-000096 or PP000010-000169).
                            </p>
                            <div className="mt-auto flex flex-wrap gap-2 justify-between items-center w-full">
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[33px] h-[33px] px-3 text-xs bg-[#2F7D55] text-white border-0 hover:bg-[#267348] shrink-0"
                                onClick={() => setValidateFittingConfirm({ sec, r })}
                                disabled={validatingFittingKey === r.id}
                              >
                                {validatingFittingKey === r.id ? "Validating…" : "Validate"}
                              </Button>
                              <Button variant="outline" size="sm" className="min-h-[33px] h-[33px] px-3 text-xs bg-[#B8682A] text-white border-0 hover:bg-[#A35D26] shrink-0" onClick={() => openViewRecordById(r.id, `Fitting: ${r.pipe_fitting_id ?? "—"}`, r.chainage, r.chainage)}>
                                View Record
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CHECK 2 — Duplicate Pipe ID */}
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
                                <Button key={r.id} variant="outline" size="sm" className="min-h-[44px]" onClick={() => openViewRecordById(r.id, `Duplicate pipe ID: ${dup.pipe_fitting_id}`, r.chainage, r.chainage)}>
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
                          <div key={r.id} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm flex flex-col min-h-[180px]">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              {r.level === "critical" ? (
                                <span className="drainer-badge-gap drainer-badge-gap-xl">Critical</span>
                              ) : (
                                <span className="drainer-badge-open drainer-badge-open-xl">Warning</span>
                              )}
                              <span className="text-sm font-medium">Record #{r.counter ?? "—"}</span>
                            </div>
                            <p className="text-sm mb-1">CH {r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })} · {r.pipe_fitting_id ?? "—"}</p>
                            <p className="text-sm mb-2">V: {(r.deflection_v_sign ?? "+")}{Math.abs(r.deflection_v_mm ?? 0)}mm  H: {(r.deflection_h_side ?? "L")}{Math.abs(r.deflection_h_mm ?? 0)}mm</p>
                            <p className="text-xs text-[var(--muted-foreground)] mb-3">
                              {r.level === "critical"
                                ? "Deflection approaching limit. Review installation before next ITR."
                                : "Deflection within range but elevated. Monitor next records."}
                            </p>
                            <div className="mt-auto flex flex-wrap gap-2 justify-between items-center w-full">
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[33px] h-[33px] px-3 text-xs bg-[#2F7D55] text-white border-0 hover:bg-[#267348] shrink-0"
                                onClick={() => setValidateNearConfirm({ sec, r })}
                                disabled={validatingNearKey === r.id}
                              >
                                {validatingNearKey === r.id ? "Validating…" : "Validate"}
                              </Button>
                              <Button variant="outline" size="sm" className="min-h-[33px] h-[33px] px-3 text-xs bg-[#B8682A] text-white border-0 hover:bg-[#A35D26] shrink-0" onClick={() => openViewRecordById(r.id, r.level === "critical" ? "Deflection approaching limit. Review installation before next ITR." : "Deflection within range but elevated. Monitor next records.", r.chainage, r.chainage)}>
                                View Record
                              </Button>
                            </div>
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
                                <Button variant="outline" size="sm" className="min-h-[44px] w-full" onClick={() => openViewRecordById(t.first_record_id!, "Deflection trend — 4 consecutive records in same direction. Possible alignment issue in trench.", chMin, chMax)}>
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
      </div>

      <RecordEditForm
        recordId={editRecordId}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditRecordId(null);
          setEditContextualNote(null);
          setEditContextChFrom(null);
          setEditContextChTo(null);
          setEditContextRecordToId(null);
        }}
        onSaved={loadAllValidation}
        getAccessToken={getAccessToken}
        contextualNote={editContextualNote}
        contextChFrom={editContextChFrom}
        contextChTo={editContextChTo}
        contextRecordToId={editContextRecordToId}
      />

      <Dialog open={!!validateFittingConfirm} onOpenChange={(o) => !o && setValidateFittingConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate fitting</DialogTitle>
          </DialogHeader>
          {validateFittingConfirm && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Mark Record #{validateFittingConfirm.r.counter ?? "?"} (CH {validateFittingConfirm.r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })}, {validateFittingConfirm.r.pipe_fitting_id ?? "—"}) as accepted? It will be removed from the list.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateFittingConfirm(null)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              onClick={() => validateFittingConfirm && handleValidateFitting(validateFittingConfirm.sec, validateFittingConfirm.r)}
              disabled={!validateFittingConfirm || validatingFittingKey !== null}
              className="min-h-[44px] bg-[#2F7D55] text-white hover:bg-[#267348]"
            >
              {validatingFittingKey ? "Validating…" : "Validate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!validateNearConfirm} onOpenChange={(o) => !o && setValidateNearConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate near-tolerance</DialogTitle>
          </DialogHeader>
          {validateNearConfirm && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Mark Record #{validateNearConfirm.r.counter ?? "?"} (CH {validateNearConfirm.r.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 })}, {validateNearConfirm.r.level}) as accepted? It will be removed from the list.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateNearConfirm(null)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              onClick={() => validateNearConfirm && handleValidateNearTolerance(validateNearConfirm.sec, validateNearConfirm.r)}
              disabled={!validateNearConfirm || validatingNearKey !== null}
              className="min-h-[44px] bg-[#2F7D55] text-white hover:bg-[#267348]"
            >
              {validatingNearKey ? "Validating…" : "Validate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!validateConfirm} onOpenChange={(o) => !o && setValidateConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate issue</DialogTitle>
          </DialogHeader>
          {validateConfirm && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Mark this {validateConfirm.inc.type} (CH {validateConfirm.inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} → {validateConfirm.inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })}) as accepted? It will be removed from the potential issues list.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateConfirm(null)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              onClick={() => validateConfirm && handleValidateInconsistency(validateConfirm.sec, validateConfirm.inc)}
              disabled={!validateConfirm || validatingKey !== null}
              className="min-h-[44px] bg-[#2F7D55] text-white hover:bg-[#267348]"
            >
              {validatingKey ? "Validating…" : "Validate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
