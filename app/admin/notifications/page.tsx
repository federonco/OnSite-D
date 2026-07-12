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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, RefreshCw } from "lucide-react";
import { DEFAULT_CRITERIA, type AnalysisCriteria } from "@/lib/analysis-criteria";

async function fetchWithTimeout(url: string, headers?: HeadersInit, ms = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    console.error("[data-analysis] fetch failed:", url, err);
    return null;
  }
}

type InconsistencyItem = {
  ch_from: number;
  ch_to: number;
  diff: number;
  type: "gap" | "overlap" | "doubleup";
  record_from_id: string;
  record_to_id: string;
  record_from_counter: number | null;
  record_from_fitting_id: string;
  record_to_fitting_id: string;
  from_joint_type: string | null;
  to_joint_type: string | null;
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

type FilterSection = { id: string; name: string };

function formatJointType(value: string | null | undefined) {
  return value?.trim() || "—";
}

function issueHint(type: InconsistencyItem["type"]) {
  if (type === "gap") return "Possible missing record between these chainages.";
  if (type === "doubleup") return "Records are within 1 m — likely a double-up / duplicate lodging.";
  return "Possible duplicate or incorrect chainage entry.";
}

function issueBadge(type: InconsistencyItem["type"]) {
  if (type === "gap") {
    return <span className="drainer-badge-gap drainer-badge-gap-lg">Gap</span>;
  }
  if (type === "doubleup") {
    return <span className="drainer-badge-gap drainer-badge-gap-lg">Doubleup</span>;
  }
  return <span className="drainer-badge-open drainer-badge-open-lg">Overlap</span>;
}

function issueDiffBadge(type: InconsistencyItem["type"], diff: number) {
  const text = `${diff.toLocaleString("en-AU", { minimumFractionDigits: 1 })}m`;
  if (type === "overlap") {
    return <span className="drainer-badge-open">{text}</span>;
  }
  return <span className="drainer-badge-gap">{text}</span>;
}

export default function NotificationsPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sectionData, setSectionData] = useState<SectionInconsistencies[]>([]);
  const [inconsistenciesLoading, setInconsistenciesLoading] = useState(true);
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
  const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");
  const [criteria, setCriteria] = useState<AnalysisCriteria>(DEFAULT_CRITERIA);
  const [savedCriteria, setSavedCriteria] = useState<AnalysisCriteria>(DEFAULT_CRITERIA);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedSectionId !== "all") {
      params.set("section_id", selectedSectionId);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [selectedSectionId]);

  const loadInconsistencies = useCallback(async () => {
    const token = await getAccessToken();
    setInconsistenciesLoading(true);
    try {
      const url = `/api/drainer/records/inconsistencies${buildFilterQuery()}`;
      const data = await fetchWithTimeout(url, token ? { Authorization: `Bearer ${token}` } : undefined);
      if (!data) {
        setSectionData([]);
        return;
      }
      if (data.sections) setSectionData(data.sections);
      else if (data.section_id) setSectionData([data]);
      else setSectionData([]);
    } finally {
      setInconsistenciesLoading(false);
    }
  }, [getAccessToken, buildFilterQuery]);

  const loadAllValidation = useCallback(
    async (showToast = false) => {
      await loadInconsistencies();
      if (showToast) {
        pushToast({ type: "success", title: "Data refreshed" });
      }
    },
    [loadInconsistencies, pushToast]
  );

  const loadFilterOptions = useCallback(async () => {
    const token = await getAccessToken();
    const sectionsRes = await fetch("/api/drainer/sections", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const sectionsJson = (await sectionsRes.json().catch(() => ({}))) as {
      sections?: { id: string; name: string }[];
    };
    setFilterSections(
      Array.isArray(sectionsJson.sections)
        ? sectionsJson.sections.map((s) => ({ id: s.id, name: s.name }))
        : []
    );
  }, [getAccessToken]);

  const loadCriteria = useCallback(async () => {
    if (selectedSectionId === "all") return;
    const token = await getAccessToken();
    if (!token) return;
    setCriteriaLoading(true);
    try {
      const res = await fetch(`/api/drainer/sections/${selectedSectionId}/analysis-criteria`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { criteria?: AnalysisCriteria; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load criteria");
      const next = data.criteria ?? DEFAULT_CRITERIA;
      setCriteria(next);
      setSavedCriteria(next);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Could not load analysis settings",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCriteriaLoading(false);
    }
  }, [getAccessToken, pushToast, selectedSectionId]);

  const hasUnsavedCriteria =
    selectedSectionId !== "all" && JSON.stringify(criteria) !== JSON.stringify(savedCriteria);

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
        loadFilterOptions();
      }
    };
    check();
  }, [authEmail, getAccessToken, loadFilterOptions]);

  useEffect(() => {
    if (!authEmail || !isAdmin) return;
    loadAllValidation();
  }, [authEmail, isAdmin, selectedSectionId, loadAllValidation]);

  useEffect(() => {
    if (!authEmail || !isAdmin) return;
    const safety = setTimeout(() => {
      setInconsistenciesLoading(false);
    }, 10000);
    return () => clearTimeout(safety);
  }, [authEmail, isAdmin, selectedSectionId]);

  useEffect(() => {
    if (!authEmail || !isAdmin || selectedSectionId === "all") return;
    void loadCriteria();
  }, [authEmail, isAdmin, selectedSectionId, loadCriteria]);

  useEffect(() => {
    if (selectedSectionId === "all") {
      setCriteria(DEFAULT_CRITERIA);
      setSavedCriteria(DEFAULT_CRITERIA);
    }
  }, [selectedSectionId]);

  const openViewRecord = (inc: InconsistencyItem) => {
    const note =
      inc.type === "gap"
        ? `Possible missing record between CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} and CH ${inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })}.`
        : inc.type === "doubleup"
          ? `Likely double-up near CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} (Δ ${inc.diff.toLocaleString("en-AU", { minimumFractionDigits: 2 })} m).`
          : `Possible duplicate or incorrect chainage entry near CH ${inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })}.`;
    setEditContextualNote(note);
    setEditContextChFrom(inc.ch_from);
    setEditContextChTo(inc.ch_to);
    setEditContextRecordToId(inc.record_to_id);
    setEditRecordId(inc.record_from_id);
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
    const key = `${sec.section_id}:${inc.record_from_id}:${inc.record_to_id}:${inc.type}`;
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

  const handleSaveCriteria = async (next: AnalysisCriteria) => {
    if (selectedSectionId === "all") return;
    setCriteriaSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/sections/${selectedSectionId}/analysis-criteria`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as { criteria?: AnalysisCriteria; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const saved = data.criteria ?? next;
      setCriteria(saved);
      setSavedCriteria(saved);
      await loadAllValidation(true);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCriteriaSaving(false);
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
              <div className="space-y-3 w-full">
                <div className="drainer-title">Data validation</div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-2 max-w-sm">
                  <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                    <SelectTrigger className="drainer-input">
                      <SelectValue placeholder="Section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {filterSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]"
                onClick={() => void loadAllValidation(true)}
                disabled={inconsistenciesLoading}
                title="Refresh"
              >
                {inconsistenciesLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
              {selectedSectionId !== "all" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]"
                      aria-label="Analysis actions"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSettingsOpen((o) => !o)}>
                      {settingsOpen ? "Hide analysis settings" : "Analysis settings"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="mt-4">
              {selectedSectionId !== "all" && settingsOpen && (
                <div className="mb-4 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)]">Analysis Settings</span>
                    {hasUnsavedCriteria ? (
                      <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">Saved</span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {criteriaLoading ? (
                      <p className="text-sm text-[var(--muted-foreground)]">Loading settings…</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <label className="text-xs text-[var(--muted-foreground)]">
                            Gap threshold (m)
                            <Input
                              type="number"
                              className="drainer-input mt-1"
                              value={criteria.gap_threshold_m}
                              onChange={(e) =>
                                setCriteria((c) => ({
                                  ...c,
                                  gap_threshold_m: Number(e.target.value) || 0,
                                }))
                              }
                            />
                          </label>
                          <label className="text-xs text-[var(--muted-foreground)]">
                            Overlap threshold (m)
                            <Input
                              type="number"
                              className="drainer-input mt-1"
                              value={criteria.overlap_threshold_m}
                              onChange={(e) =>
                                setCriteria((c) => ({
                                  ...c,
                                  overlap_threshold_m: Number(e.target.value) || 0,
                                }))
                              }
                            />
                          </label>
                          <label className="text-xs text-[var(--muted-foreground)]">
                            Doubleup threshold (m)
                            <Input
                              type="number"
                              className="drainer-input mt-1"
                              value={criteria.doubleup_threshold_m}
                              onChange={(e) =>
                                setCriteria((c) => ({
                                  ...c,
                                  doubleup_threshold_m: Number(e.target.value) || 0,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[40px]"
                            disabled={criteriaSaving}
                            onClick={() => void handleSaveCriteria(DEFAULT_CRITERIA)}
                          >
                            Reset to defaults
                          </Button>
                          <Button
                            size="sm"
                            className="min-h-[40px] bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
                            disabled={criteriaSaving || !hasUnsavedCriteria}
                            onClick={() => void handleSaveCriteria(criteria)}
                          >
                            {criteriaSaving ? "Saving…" : "Save & Re-analyse"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {inconsistenciesLoading ? (
                <p className="text-sm text-[var(--muted-foreground)] py-4">Loading…</p>
              ) : !hasInconsistencies ? (
                <p className="text-sm text-green-600 py-4">✅ No inconsistencies detected</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allInconsistencies.map(({ inc, sec }, idx) => {
                    const validatingId = `${sec.section_id}:${inc.record_from_id}:${inc.record_to_id}:${inc.type}`;
                    return (
                      <div
                        key={`${sec.section_id}-${inc.type}-${idx}`}
                        className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm flex flex-col min-h-[180px]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          {issueBadge(inc.type)}
                          <span className="text-sm font-medium">
                            Record #{inc.record_from_counter ?? "—"}
                          </span>
                        </div>
                        <p className="text-sm mb-1">
                          CH {inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} →{" "}
                          {inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })} ·{" "}
                          {issueDiffBadge(inc.type, inc.diff)}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mb-1">
                          Joint: {formatJointType(inc.from_joint_type)} →{" "}
                          {formatJointType(inc.to_joint_type)}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mb-3">
                          {issueHint(inc.type)}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-2 justify-between items-center w-full">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[33px] h-[33px] px-3 text-xs bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] hover:bg-[var(--surface-alt)]"
                              onClick={() => openDeleteConfirm(inc)}
                            >
                              Delete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[33px] h-[33px] px-3 text-xs bg-[#2F7D55] text-white border-0 hover:bg-[#267348] shrink-0"
                              onClick={() => setValidateConfirm({ sec, inc })}
                              disabled={validatingKey === validatingId}
                            >
                              {validatingKey === validatingId ? "Validating…" : "Validate"}
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[33px] h-[33px] px-3 text-xs bg-[#B8682A] text-white border-0 hover:bg-[#A35D26] shrink-0"
                            onClick={() => openViewRecord(inc)}
                          >
                            View Record
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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

      <Dialog open={!!validateConfirm} onOpenChange={(o) => !o && setValidateConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate issue</DialogTitle>
          </DialogHeader>
          {validateConfirm && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Mark this {validateConfirm.inc.type} (CH{" "}
              {validateConfirm.inc.ch_from.toLocaleString("en-AU", { minimumFractionDigits: 2 })} →{" "}
              {validateConfirm.inc.ch_to.toLocaleString("en-AU", { minimumFractionDigits: 2 })}) as
              accepted? It will be removed from the potential issues list.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateConfirm(null)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              onClick={() =>
                validateConfirm &&
                handleValidateInconsistency(validateConfirm.sec, validateConfirm.inc)
              }
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
            Delete record #{deleteConfirm?.counter ?? "?"} (CH{" "}
            {deleteConfirm?.chainage.toLocaleString("en-AU", { minimumFractionDigits: 2 }) ?? "?"})?
            This cannot be undone from the app.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRecord}
              disabled={deleteLoading}
              className="min-h-[44px]"
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
