"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { recordCatalogSectionId } from "@/lib/section-catalog";
import { RecordEditForm } from "@/components/admin/record-edit-form";
import type { WeldWrapSectionContext } from "@/lib/weld-wrap/section-context";
import {
  WELD_WRAP_STATUS_FILTER_OPTIONS,
  type WeldWrapStatusFilterKey,
} from "@/lib/reporting/weld-wrap/report-filters";
import { Loader2, RefreshCw } from "lucide-react";

type SectionInfo = { name: string | null } | null;

type WeldRecord = {
  id: string;
  counter: number | null;
  chainage: number | null;
  pipe_fitting_id: string | null;
  joint_type: "WR" | "WB" | string | null;
  date_installed: string | null;
  welded_at: string | null;
  wrapped_at: string | null;
  comments: string | null;
  welded_steps?: {
    external_1?: string | null;
    external_2?: string | null;
    internal_1?: string | null;
    internal_2?: string | null;
  } | null;
  section_id: string | null;
  unified_section_id?: string | null;
  drainer_sections?: SectionInfo;
};

type ToggleField = "welded_at" | "wrapped_at";
type WeldStepKey = "external_1" | "external_2" | "internal_1" | "internal_2";
const WB_STEPS: WeldStepKey[] = ["external_1", "external_2", "internal_1", "internal_2"];

function isSimpleWeldJoint(jointType: string | null | undefined): boolean {
  return jointType === "WR" || jointType === "Transition";
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Calendar day in local timezone vs `new Date()` */
function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function latestWbStepIso(record: WeldRecord): string | null {
  const times = WB_STEPS.map((s) => record.welded_steps?.[s]).filter(Boolean) as string[];
  if (times.length === 0) return null;
  return times.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

function isWeldFullyComplete(record: WeldRecord): boolean {
  if (isSimpleWeldJoint(record.joint_type)) return !!record.welded_at;
  if (record.joint_type === "WB")
    return WB_STEPS.every((step) => !!record.welded_steps?.[step]);
  return false;
}

function isWeldCompletedToday(record: WeldRecord): boolean {
  if (!isWeldFullyComplete(record)) return false;
  if (isSimpleWeldJoint(record.joint_type)) return isToday(record.welded_at);
  const ref = record.welded_at ?? latestWbStepIso(record);
  return ref ? isToday(ref) : false;
}

function DbField({ children }: { children: string }) {
  return (
    <code className="rounded bg-gray-700 px-1 font-mono text-[10px] text-white">
      {children}
    </code>
  );
}

interface MetricTooltipProps {
  label: string;
  formula: ReactNode;
}

function MetricTooltip({ label, formula }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const showAt = (clientX: number, clientY: number) => {
    setCoords({ x: clientX, y: clientY });
    setOpen(true);
  };

  return (
    <>
      <span
        className="inline-flex cursor-help items-center gap-0.5"
        onMouseEnter={(e) => showAt(e.clientX, e.clientY)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            showAt(e.clientX, e.clientY);
          }
        }}
      >
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="text-[8px] text-[var(--muted-foreground)]" aria-hidden>
          ⓘ
        </span>
      </span>
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-50 w-max max-w-[260px] rounded px-3 py-2 text-xs leading-snug text-white shadow-md"
          style={{
            backgroundColor: "#1a1a1a",
            left: coords.x + 8,
            top: coords.y + 12,
          }}
        >
          {formula}
        </span>
      ) : null}
    </>
  );
}

function SummaryRow({
  label,
  formula,
  value,
}: {
  label: string;
  formula: ReactNode;
  value: string | number;
}) {
  return (
    <div className="min-w-0 text-[10px] leading-snug">
      <MetricTooltip label={label} formula={formula} />
      <span className="text-[var(--muted-foreground)]"> = </span>
      <span className="font-semibold tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}

export function WeldTrackingTable() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<WeldRecord[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [reportDefaultEmail, setReportDefaultEmail] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [reportStatusFilters, setReportStatusFilters] = useState<WeldWrapStatusFilterKey[]>(
    []
  );
  const [sectionContext, setSectionContext] = useState<WeldWrapSectionContext | null>(
    null
  );

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token ?? null;
  }, [supabase]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/drainer/weld-tracking", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json().catch(() => ({}))) as {
        records?: WeldRecord[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load weld tracking records.");
      }
      setRecords(Array.isArray(data.records) ? data.records : []);
      const drafts: Record<string, string> = {};
      for (const record of data.records ?? []) {
        drafts[record.id] = record.comments ?? "";
      }
      setCommentDrafts(drafts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const res = await fetch("/api/drainer/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled || !res.ok) return;
      const json = (await res.json()) as {
        reportDefaultEmail?: string;
        email?: string | null;
      };
      setReportDefaultEmail(json.reportDefaultEmail || json.email || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const loadSectionContext = useCallback(async () => {
    if (!sectionFilter || sectionFilter === "all") {
      setSectionContext(null);
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(
      `/api/drainer/weld-tracking/section-context?sectionId=${encodeURIComponent(sectionFilter)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = (await res.json().catch(() => ({}))) as {
      context?: WeldWrapSectionContext;
    };
    if (res.ok && data.context) {
      setSectionContext(data.context);
    } else {
      setSectionContext(null);
    }
  }, [sectionFilter, getAccessToken]);

  useEffect(() => {
    loadSectionContext();
  }, [loadSectionContext, records]);

  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of records) {
      const catalogId = recordCatalogSectionId(record);
      if (!catalogId) continue;
      const sectionName = record.drainer_sections?.name?.trim();
      map.set(catalogId, sectionName || catalogId);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  useEffect(() => {
    if (sections.length === 0) return;
    setSectionFilter((prev) =>
      prev === "all" || !sections.some((section) => section.id === prev)
        ? sections[0].id
        : prev
    );
  }, [sections]);

  const visibleRecords = useMemo(
    () =>
      records.filter(
        (record) => recordCatalogSectionId(record) === sectionFilter
      ),
    [records, sectionFilter]
  );

  const {
    wrWeldDone,
    wrWeldPending,
    wbWeldDone,
    wbWeldPending,
    wrapDone,
    wrapPending,
    weldingDoneToday,
    wrappingDoneToday,
  } = useMemo(() => {
    const wrRecords = visibleRecords.filter((r) => isSimpleWeldJoint(r.joint_type));
    const wbRecords = visibleRecords.filter((r) => r.joint_type === "WB");
    const wrWeldDoneCount = wrRecords.filter((r) => !!r.welded_at).length;
    const wrWeldPendingCount = wrRecords.length - wrWeldDoneCount;
    const wbWeldDoneCount = wbRecords.filter((r) =>
      WB_STEPS.every((step) => !!r.welded_steps?.[step])
    ).length;
    const wbWeldPendingCount = wbRecords.length - wbWeldDoneCount;
    const wrapDoneCount = visibleRecords.filter((r) => !!r.wrapped_at).length;
    const wrapPendingCount = visibleRecords.length - wrapDoneCount;
    const weldingDoneTodayCount = visibleRecords.filter((r) =>
      isWeldCompletedToday(r)
    ).length;
    const wrappingDoneTodayCount = visibleRecords.filter((r) =>
      isToday(r.wrapped_at)
    ).length;
    return {
      wrWeldDone: wrWeldDoneCount,
      wrWeldPending: wrWeldPendingCount,
      wbWeldDone: wbWeldDoneCount,
      wbWeldPending: wbWeldPendingCount,
      wrapDone: wrapDoneCount,
      wrapPending: wrapPendingCount,
      weldingDoneToday: weldingDoneTodayCount,
      wrappingDoneToday: wrappingDoneTodayCount,
    };
  }, [visibleRecords]);

  const onToggle = useCallback(
    async (recordId: string, field: ToggleField) => {
      const current = records.find((record) => record.id === recordId);
      if (!current) return;

      const previousValue = current[field];
      const nextValue = previousValue ? null : new Date().toISOString();

      setRecords((prev) =>
        prev.map((record) =>
          record.id === recordId ? { ...record, [field]: nextValue } : record
        )
      );

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/drainer/weld-tracking", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: recordId,
            field,
            value: nextValue,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          record?: Pick<WeldRecord, "id" | "welded_at" | "wrapped_at">;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error ?? "Update failed");
        }

        if (data.record) {
          setRecords((prev) =>
            prev.map((record) =>
              record.id === recordId
                ? {
                    ...record,
                    welded_at: data.record?.welded_at ?? null,
                    wrapped_at: data.record?.wrapped_at ?? null,
                  }
                : record
            )
          );
        }
      } catch (err) {
        setRecords((prev) =>
          prev.map((record) =>
            record.id === recordId ? { ...record, [field]: previousValue } : record
          )
        );
        pushToast({
          type: "error",
          title: "Update failed",
          message: err instanceof Error ? err.message : "Could not update status.",
        });
      }
    },
    [getAccessToken, pushToast, records]
  );

  const onSaveComments = useCallback(
    async (recordId: string, draft: string) => {
      const current = records.find((record) => record.id === recordId);
      if (!current) return;

      const nextValue = draft.trim() || null;
      const storedValue = current.comments ?? null;
      if (nextValue === storedValue) return;

      const previousValue = current.comments;
      setRecords((prev) =>
        prev.map((record) =>
          record.id === recordId ? { ...record, comments: nextValue } : record
        )
      );

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/drainer/weld-tracking", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: recordId,
            field: "comments",
            value: nextValue,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          record?: Pick<WeldRecord, "id" | "comments">;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error ?? "Update failed");
        }

        if (data.record) {
          setRecords((prev) =>
            prev.map((record) =>
              record.id === recordId
                ? { ...record, comments: data.record?.comments ?? null }
                : record
            )
          );
          setCommentDrafts((prev) => ({
            ...prev,
            [recordId]: data.record?.comments ?? "",
          }));
        }
      } catch (err) {
        setRecords((prev) =>
          prev.map((record) =>
            record.id === recordId ? { ...record, comments: previousValue ?? null } : record
          )
        );
        setCommentDrafts((prev) => ({
          ...prev,
          [recordId]: previousValue ?? "",
        }));
        pushToast({
          type: "error",
          title: "Update failed",
          message: err instanceof Error ? err.message : "Could not save comments.",
        });
      }
    },
    [getAccessToken, pushToast, records]
  );

  const openSendReportModal = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setReportEmail(
      reportDefaultEmail || data.session?.user.email || ""
    );
    setReportModalOpen(true);
  }, [reportDefaultEmail, supabase]);

  const toggleReportStatusFilter = useCallback((key: WeldWrapStatusFilterKey) => {
    if (key === "all") {
      setReportStatusFilters([]);
      return;
    }
    setReportStatusFilters((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }, []);

  const reportFiltersPayload = useMemo(
    () => (reportStatusFilters.length > 0 ? reportStatusFilters : undefined),
    [reportStatusFilters]
  );

  const handleSendReport = useCallback(async () => {
    if (!sectionFilter || sectionFilter === "all" || !reportEmail.trim()) return;
    setSendingReport(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/report/weld-wrap/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sectionId: sectionFilter,
          recipientEmail: reportEmail.trim(),
          statusFilters: reportFiltersPayload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      pushToast({
        type: "success",
        title: "Report sent",
        message: `Weld & Wrap report sent to ${reportEmail.trim()}`,
      });
      setReportModalOpen(false);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Send failed",
        message: err instanceof Error ? err.message : "Could not send report.",
      });
    } finally {
      setSendingReport(false);
    }
  }, [sectionFilter, reportEmail, reportFiltersPayload, getAccessToken, pushToast]);

  const onToggleWbStep = useCallback(
    async (recordId: string, step: WeldStepKey) => {
      const current = records.find((record) => record.id === recordId);
      if (!current || current.joint_type !== "WB") return;

      const currentSteps = current.welded_steps ?? {};
      const previousStepValue = currentSteps[step] ?? null;
      const nextStepValue = previousStepValue ? null : new Date().toISOString();
      const nextSteps = { ...currentSteps, [step]: nextStepValue };
      const allChecked = WB_STEPS.every((item) => !!nextSteps[item]);
      const nextWeldedAt = allChecked ? new Date().toISOString() : null;

      setRecords((prev) =>
        prev.map((record) =>
          record.id === recordId
            ? { ...record, welded_steps: nextSteps, welded_at: nextWeldedAt }
            : record
        )
      );

      try {
        const token = await getAccessToken();
        const baseHeaders = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const patchSteps = await fetch("/api/drainer/weld-tracking", {
          method: "PATCH",
          headers: baseHeaders,
          body: JSON.stringify({
            id: recordId,
            field: "welded_steps",
            value: nextSteps,
          }),
        });
        const patchStepsData = (await patchSteps.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!patchSteps.ok) {
          throw new Error(patchStepsData.error ?? "Update failed");
        }

        const patchWeldedAt = await fetch("/api/drainer/weld-tracking", {
          method: "PATCH",
          headers: baseHeaders,
          body: JSON.stringify({
            id: recordId,
            field: "welded_at",
            value: nextWeldedAt,
          }),
        });
        const patchWeldedData = (await patchWeldedAt.json().catch(() => ({}))) as {
          record?: Pick<WeldRecord, "id" | "welded_at" | "wrapped_at" | "welded_steps">;
          error?: string;
        };
        if (!patchWeldedAt.ok) {
          throw new Error(patchWeldedData.error ?? "Update failed");
        }

        if (patchWeldedData.record) {
          setRecords((prev) =>
            prev.map((record) =>
              record.id === recordId
                ? {
                    ...record,
                    welded_at: patchWeldedData.record?.welded_at ?? null,
                    wrapped_at: patchWeldedData.record?.wrapped_at ?? null,
                    welded_steps: patchWeldedData.record?.welded_steps ?? nextSteps,
                  }
                : record
            )
          );
        }
      } catch (err) {
        setRecords((prev) =>
          prev.map((record) =>
            record.id === recordId
              ? {
                  ...record,
                  welded_steps: current.welded_steps ?? null,
                  welded_at: current.welded_at,
                }
              : record
          )
        );
        pushToast({
          type: "error",
          title: "Update failed",
          message: err instanceof Error ? err.message : "Could not update weld checks.",
        });
      }
    },
    [getAccessToken, pushToast, records]
  );

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-10 animate-pulse rounded-md bg-[var(--surface-alt)]" />
        <div className="h-10 animate-pulse rounded-md bg-[var(--surface-alt)]" />
        <div className="h-10 animate-pulse rounded-md bg-[var(--surface-alt)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--danger)]">Failed to load tracking records.</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[32px] px-3 text-xs"
            onClick={loadRecords}
          >
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex w-full min-w-0 items-center gap-2">
        {sections.length > 1 ? (
          <div className="min-w-0 flex-1">
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="drainer-input h-10 w-full min-w-0 max-w-full">
                <SelectValue placeholder="Filter by section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 min-h-10 min-w-[40px] shrink-0 px-2"
          onClick={loadRecords}
          aria-label="Refresh weld tracking"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
        {WELD_WRAP_STATUS_FILTER_OPTIONS.map((option) => {
          const checked =
            option.key === "all"
              ? reportStatusFilters.length === 0
              : reportStatusFilters.includes(option.key);
          return (
            <label
              key={option.key}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-[10px] text-[var(--ink)]"
            >
              <input
                type="checkbox"
                className="size-3 shrink-0 accent-[#B8682A]"
                checked={checked}
                onChange={() => toggleReportStatusFilter(option.key)}
              />
              {option.label}
            </label>
          );
        })}
      </div>

      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 min-h-10 shrink-0 whitespace-nowrap px-4 text-xs sm:text-sm"
          onClick={openSendReportModal}
          disabled={!sectionFilter || sectionFilter === "all" || sendingReport}
        >
          Send report
        </Button>
      </div>

      <div className="mb-2 w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-3 py-2 shadow-sm">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Section summary
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-left sm:gap-x-8">
          <SummaryRow
            label="Welds done (WR)"
            formula={
              <>
                (WR + Transition) with <DbField>welded_at</DbField> ≠ null
              </>
            }
            value={wrWeldDone}
          />
          <SummaryRow
            label="Welds pending (WR)"
            formula={
              <>
                (WR + Transition) with <DbField>welded_at</DbField> = null
              </>
            }
            value={wrWeldPending}
          />
          <SummaryRow
            label="Welds done (WB)"
            formula={
              <>
                WB with <DbField>welded_at</DbField> ≠ null
              </>
            }
            value={wbWeldDone}
          />
          <SummaryRow
            label="Welds pending (WB)"
            formula={
              <>
                WB with <DbField>welded_at</DbField> = null
              </>
            }
            value={wbWeldPending}
          />
          <hr className="col-span-full my-0.5 border-0 border-t border-[var(--border)]" />
          <SummaryRow
            label="Wrapping done"
            formula={
              <>
                (WR+WB+TR) with <DbField>wrapped_at</DbField> ≠ null
              </>
            }
            value={wrapDone}
          />
          <SummaryRow
            label="Wrapping pending"
            formula={
              <>
                (WR+WB+TR) with <DbField>wrapped_at</DbField> = null
              </>
            }
            value={wrapPending}
          />
          <hr className="col-span-full my-0.5 border-0 border-t border-[var(--border)]" />
          <SummaryRow
            label="Welding done today"
            formula={
              <>
                (WR + Transition) or WB with <DbField>welded_at</DbField> = today
              </>
            }
            value={weldingDoneToday}
          />
          <SummaryRow
            label="Wrapping done today"
            formula={
              <>
                (WR+WB+TR) with <DbField>wrapped_at</DbField> = today
              </>
            }
            value={wrappingDoneToday}
          />
          <hr className="col-span-full my-0.5 border-0 border-t border-[var(--border)]" />
          <SummaryRow
            label="Backfill up to"
            formula={<>MIN(chainage) from PSP records in this section</>}
            value={
              sectionContext?.backfillUpTo != null
                ? sectionContext.backfillUpTo.toLocaleString("en-AU")
                : "—"
            }
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <div className={visibleRecords.length > 20 ? "max-h-[720px] overflow-y-auto" : ""}>
          <table className="min-w-[600px] w-full text-sm">
            <thead className="bg-[var(--surface-alt)]">
              <tr className="text-left uppercase tracking-wide text-[var(--muted-foreground)]">
                <th className="w-10 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">#</th>
                <th className="w-16 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">CH</th>
                <th className="w-28 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">
                  Pipe/Fitting ID
                </th>
                <th className="w-16 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">Joint Type</th>
                <th className="w-24 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">Welded</th>
                <th className="w-24 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">Wrapped</th>
                <th className="min-w-[8rem] px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">Comments</th>
                <th className="w-10 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">Edit</th>
              </tr>
            </thead>
            <tbody>
            {visibleRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-2 py-1.5 sm:px-3 sm:py-6 text-center text-xs sm:text-sm text-[var(--muted-foreground)]"
                >
                  No WR/WB records found.
                </td>
              </tr>
            ) : (
              visibleRecords.map((record) => {
                const weldedOn = formatDate(record.welded_at);
                const wrappedOn = formatDate(record.wrapped_at);
                const isWR = record.joint_type === "WR";
                const isTransition = record.joint_type === "Transition";
                const steps = record.welded_steps ?? {};
                return (
                  <tr key={record.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2 font-medium">
                      {record.counter ?? "-"}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">{record.chainage ?? "-"}</td>
                    <td className="max-w-[7rem] truncate px-2 py-1.5 sm:px-3 sm:py-2">
                      {record.pipe_fitting_id || "-"}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                      {isTransition ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          TR
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={
                            isWR ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                          }
                        >
                          {record.joint_type ?? "-"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                      {record.joint_type === "WB" ? (
                        <div className="grid grid-cols-2 gap-1">
                          {WB_STEPS.map((step, index) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => onToggleWbStep(record.id, step)}
                              className={`h-6 w-10 rounded border text-[10px] font-semibold ${
                                steps[step]
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]"
                              }`}
                              aria-label={`Toggle weld step ${step}`}
                            >
                              {index < 2 ? `E${index + 1}` : `I${index - 1}`}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggle(record.id, "welded_at")}
                          className={`h-6 w-6 rounded border text-xs font-bold ${
                            record.welded_at
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]"
                          }`}
                          aria-label="Toggle welded"
                        >
                          {record.welded_at ? "✓" : ""}
                        </button>
                      )}
                      {weldedOn ? (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{weldedOn}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                      <button
                        type="button"
                        onClick={() => onToggle(record.id, "wrapped_at")}
                        className={`h-6 w-6 rounded border text-xs font-bold ${
                          record.wrapped_at
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]"
                        }`}
                        aria-label="Toggle wrapped"
                      >
                        {record.wrapped_at ? "✓" : ""}
                      </button>
                      {wrappedOn ? (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{wrappedOn}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                      <textarea
                        rows={1}
                        value={commentDrafts[record.id] ?? ""}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [record.id]: e.target.value,
                          }))
                        }
                        onBlur={() =>
                          onSaveComments(record.id, commentDrafts[record.id] ?? "")
                        }
                        className="w-full min-w-[8rem] resize-y rounded border border-[var(--border)] bg-white px-2 py-1 text-xs sm:text-sm text-[var(--ink)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        placeholder="Add comment…"
                      />
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[32px] px-2 text-xs sm:px-3"
                        onClick={() => setEditingRecordId(record.id)}
                      >
                        Edit record
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
      <RecordEditForm
        recordId={editingRecordId}
        open={!!editingRecordId}
        onClose={() => setEditingRecordId(null)}
        onSaved={loadRecords}
        getAccessToken={getAccessToken}
      />

      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send report to</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Weld &amp; Wrap status report for the selected section (PDF attached).
            </p>
            <Input
              type="email"
              placeholder="Email address"
              value={reportEmail}
              onChange={(e) => setReportEmail(e.target.value)}
              className="drainer-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendReport}
              disabled={!reportEmail.trim() || sendingReport}
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
              {sendingReport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 mr-1" />
                  Sending…
                </>
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
