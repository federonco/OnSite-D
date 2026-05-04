"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { RecordEditForm } from "@/components/admin/record-edit-form";
import { RefreshCw } from "lucide-react";

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
  welded_steps?: {
    external_1?: string | null;
    external_2?: string | null;
    internal_1?: string | null;
    internal_2?: string | null;
  } | null;
  section_id: string | null;
  drainer_sections?: SectionInfo;
};

type ToggleField = "welded_at" | "wrapped_at";
type WeldStepKey = "external_1" | "external_2" | "internal_1" | "internal_2";
const WB_STEPS: WeldStepKey[] = ["external_1", "external_2", "internal_1", "internal_2"];

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
  if (record.joint_type === "WR") return !!record.welded_at;
  if (record.joint_type === "WB")
    return WB_STEPS.every((step) => !!record.welded_steps?.[step]);
  return false;
}

function isWeldCompletedToday(record: WeldRecord): boolean {
  if (!isWeldFullyComplete(record)) return false;
  if (record.joint_type === "WR") return isToday(record.welded_at);
  const ref = record.welded_at ?? latestWbStepIso(record);
  return ref ? isToday(ref) : false;
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 text-[10px] leading-snug">
      <span className="text-[var(--muted-foreground)]">{label}</span>
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
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

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

  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of records) {
      if (!record.section_id) continue;
      const sectionName = record.drainer_sections?.name?.trim();
      map.set(record.section_id, sectionName || record.section_id);
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
    () => records.filter((record) => record.section_id === sectionFilter),
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
    const wrRecords = visibleRecords.filter((r) => r.joint_type === "WR");
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
          className={`h-10 min-w-[40px] shrink-0 px-2 ${sections.length <= 1 ? "ml-auto" : ""}`}
          onClick={loadRecords}
          aria-label="Refresh weld tracking"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="mb-2 w-full min-w-0 rounded-md border border-[var(--border)] bg-white px-3 py-2 shadow-sm">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Section summary
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-left sm:gap-x-8">
          <SummaryRow label="Welds done (WR)" value={wrWeldDone} />
          <SummaryRow label="Welds pending (WR)" value={wrWeldPending} />
          <SummaryRow label="Welds done (WB)" value={wbWeldDone} />
          <SummaryRow label="Welds pending (WB)" value={wbWeldPending} />
          <hr className="col-span-full my-0.5 border-0 border-t border-[var(--border)]" />
          <SummaryRow label="Wrapping done" value={wrapDone} />
          <SummaryRow label="Wrapping pending" value={wrapPending} />
          <hr className="col-span-full my-0.5 border-0 border-t border-[var(--border)]" />
          <SummaryRow label="Welding done today" value={weldingDoneToday} />
          <SummaryRow label="Wrapping done today" value={wrappingDoneToday} />
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
                <th className="w-10 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm">Edit</th>
              </tr>
            </thead>
            <tbody>
            {visibleRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                      <Badge
                        variant="secondary"
                        className={isWR ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}
                      >
                        {record.joint_type ?? "-"}
                      </Badge>
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
    </div>
  );
}
