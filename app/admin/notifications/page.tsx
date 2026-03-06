"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoaderCircle } from "lucide-react";

const JOINT_TYPES = [
  { value: "RRJ", label: "RRJ (Rubber Ring Joint)" },
  { value: "WR", label: "WR (Weld Restricted)" },
  { value: "WB", label: "WB" },
  { value: "CWB", label: "CWB" },
] as const;

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

type AddRecordPayload = {
  sectionId: string;
  sectionName?: string;
  chainage: number;
  chFrom: number;
  chTo: number;
};

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [missed, setMissed] = useState<MissedCheckpoint[]>([]);
  const [sectionData, setSectionData] = useState<SectionInconsistencies[]>([]);
  const [inconsistenciesLoading, setInconsistenciesLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addPayload, setAddPayload] = useState<AddRecordPayload | null>(null);
  const [addChainage, setAddChainage] = useState("");
  const [addPipeFittingId, setAddPipeFittingId] = useState("");
  const [addJointType, setAddJointType] = useState("");
  const [addWitnessMark, setAddWitnessMark] = useState(false);
  const [addInternalSeal, setAddInternalSeal] = useState(false);
  const [addOvalityCheck, setAddOvalityCheck] = useState(false);
  const [addCementLiner, setAddCementLiner] = useState(false);
  const [addSparkTesting, setAddSparkTesting] = useState(false);
  const [addCpLugs, setAddCpLugs] = useState(false);
  const [addJointAirTest, setAddJointAirTest] = useState(false);
  const [addDeflectionVSign, setAddDeflectionVSign] = useState<"+" | "-">("+");
  const [addDeflectionVMm, setAddDeflectionVMm] = useState("");
  const [addDeflectionHSide, setAddDeflectionHSide] = useState<"L" | "R">("L");
  const [addDeflectionHMm, setAddDeflectionHMm] = useState("");
  const [addChainageStatus, setAddChainageStatus] = useState<"idle" | "checking" | "exists" | "clear">("idle");
  const [addIsDuplicate, setAddIsDuplicate] = useState(false);
  const [addInspectorName, setAddInspectorName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

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
      }
    };
    check();
  }, [authEmail, getAccessToken, loadMissed, loadInconsistencies]);

  const checkDuplicateChainage = useCallback(
    async (sectionId: string, ch: number) => {
      setAddChainageStatus("checking");
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `/api/drainer/records/check-duplicate?sectionId=${sectionId}&chainage=${ch}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const data = await res.json();
        const duplicate = !!data.duplicate;
        setAddIsDuplicate(duplicate);
        setAddChainageStatus(duplicate ? "exists" : "clear");
      } catch {
        setAddChainageStatus("idle");
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (!addModalOpen || !addPayload || !addChainage) {
      setAddChainageStatus("idle");
      setAddIsDuplicate(false);
      return;
    }
    const ch = parseFloat(addChainage);
    if (!Number.isFinite(ch)) {
      setAddChainageStatus("idle");
      return;
    }
    const t = setTimeout(
      () => checkDuplicateChainage(addPayload.sectionId, ch),
      400
    );
    return () => clearTimeout(t);
  }, [addModalOpen, addPayload, addChainage, checkDuplicateChainage]);

  const openAddModal = (inc: InconsistencyItem, sec: SectionInconsistencies) => {
    const estimatedCh =
      inc.type === "gap"
        ? (inc.ch_from + inc.ch_to) / 2
        : inc.ch_from + (inc.ch_to - inc.ch_from) / 2;
    setAddPayload({
      sectionId: sec.section_id,
      sectionName: sec.section_name,
      chainage: estimatedCh,
      chFrom: inc.ch_from,
      chTo: inc.ch_to,
    });
    setAddChainage(estimatedCh.toFixed(3));
    setAddPipeFittingId("");
    setAddJointType("");
    setAddWitnessMark(false);
    setAddInternalSeal(false);
    setAddOvalityCheck(false);
    setAddCementLiner(false);
    setAddSparkTesting(false);
    setAddCpLugs(false);
    setAddJointAirTest(false);
    setAddDeflectionVSign("+");
    setAddDeflectionVMm("");
    setAddDeflectionHSide("L");
    setAddDeflectionHMm("");
    setAddChainageStatus("idle");
    setAddIsDuplicate(false);
    setAddInspectorName("");
    setAddModalOpen(true);
  };

  const addShowCpLugs = addJointType === "RRJ";
  const addShowJointAirTest = addJointType === "RRJ" || addJointType === "WR";

  useEffect(() => {
    if (!addShowCpLugs) setAddCpLugs(false);
    if (!addShowJointAirTest) setAddJointAirTest(false);
  }, [addShowCpLugs, addShowJointAirTest]);
  const addVInvalid = Math.abs(Number(addDeflectionVMm) || 0) > 50;
  const addHInvalid = Math.abs(Number(addDeflectionHMm) || 0) > 100;
  const addAllChecklistChecked =
    addWitnessMark &&
    addInternalSeal &&
    addOvalityCheck &&
    addCementLiner &&
    addSparkTesting &&
    (addShowCpLugs ? addCpLugs : true) &&
    (addShowJointAirTest ? addJointAirTest : true);
  const addFormValid =
    !!addPayload &&
    !!addChainage &&
    Number.isFinite(parseFloat(addChainage)) &&
    !!addPipeFittingId.trim() &&
    !!addJointType &&
    !addVInvalid &&
    !addHInvalid &&
    !addIsDuplicate &&
    addAllChecklistChecked;

  const handleAddRecord = async () => {
    if (!addPayload || !addFormValid) return;
    const ch = parseFloat(addChainage);
    if (!Number.isFinite(ch)) {
      pushToast({ type: "error", title: "Invalid chainage" });
      return;
    }
    const vMm = Math.abs(Number(addDeflectionVMm) || 0);
    const hMm = Math.abs(Number(addDeflectionHMm) || 0);
    setAddLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: addPayload.sectionId,
          chainage: ch,
          pipe_fitting_id: addPipeFittingId.trim() || null,
          joint_type: addJointType || null,
          date_installed: new Date().toISOString().slice(0, 10),
          witness_mark: addWitnessMark,
          internal_seal: addInternalSeal,
          ovality_check: addOvalityCheck,
          cement_liner: addCementLiner,
          spark_testing: addSparkTesting,
          cp_lugs: addShowCpLugs ? addCpLugs : null,
          joint_air_test: addShowJointAirTest ? addJointAirTest : null,
          deflection_v_sign: addDeflectionVSign,
          deflection_v_mm: vMm,
          deflection_h_side: addDeflectionHSide,
          deflection_h_mm: hMm,
          inspector_name: addInspectorName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      pushToast({ type: "success", title: "Record added" });
      setAddModalOpen(false);
      setAddPayload(null);
      loadInconsistencies();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const navigateToRecords = (
    sectionId: string,
    recordFromId: string,
    recordToId: string
  ) => {
    const params = new URLSearchParams({
      recordFromId,
      recordToId,
      context: "2",
    });
    router.push(`/admin/records/${sectionId}?${params}`);
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
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">
              ⚠️ Record Inconsistencies
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInconsistencies}
              disabled={inconsistenciesLoading}
            >
              {inconsistenciesLoading ? "Loading…" : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent>
            {inconsistenciesLoading ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4">
                Loading…
              </p>
            ) : !hasInconsistencies ? (
              <p className="text-sm text-green-600 py-4">
                ✅ No inconsistencies detected
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2">Section</th>
                      <th className="text-left py-2 px-2">CH From</th>
                      <th className="text-left py-2 px-2">ID From</th>
                      <th className="text-left py-2 px-2">CH To</th>
                      <th className="text-left py-2 px-2">ID To</th>
                      <th className="text-left py-2 px-2">Difference</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-left py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allInconsistencies.map(({ inc, sec }, idx) => (
                      <tr
                        key={`${sec.section_id}-${idx}`}
                        className="border-b border-[var(--border)]/50"
                      >
                        <td className="py-2 px-2">{sec.section_name ?? sec.section_id}</td>
                        <td className="py-2 px-2">
                          {inc.ch_from.toLocaleString("en-AU", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {inc.record_from_fitting_id || "—"}
                        </td>
                        <td className="py-2 px-2">
                          {inc.ch_to.toLocaleString("en-AU", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {inc.record_to_fitting_id || "—"}
                        </td>
                        <td className="py-2 px-2">
                          {inc.diff.toLocaleString("en-AU", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          m
                        </td>
                        <td className="py-2 px-2 flex flex-wrap gap-1 items-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              inc.type === "gap"
                                ? "bg-red-500 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {inc.type === "gap"
                              ? "🔴 Gap >13m"
                              : "🟡 Overlap <12m"}
                          </span>
                          {(inc.inferred_type_from === "fitting" ||
                            inc.inferred_type_to === "fitting") && (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-400 text-white">
                              May be fitting
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 flex gap-1 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() =>
                              navigateToRecords(sec.section_id, inc.record_from_id, inc.record_to_id)
                            }
                          >
                            View records
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => openAddModal(inc, sec)}
                          >
                            Add record
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="drainer-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Missed Checkpoint Alerts</CardTitle>
            <Button variant="outline" size="sm" onClick={loadMissed}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2">Name</th>
                      <th className="text-left py-2 px-2">Checkpoint CH</th>
                      <th className="text-left py-2 px-2">CH when exceeded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missed.map((m) => (
                      <tr key={m.id} className="border-b border-[var(--border)]/50">
                        <td className="py-2 px-2 font-medium">{m.name}</td>
                        <td className="py-2 px-2">
                          {m.ch.toLocaleString("en-AU", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2 px-2">
                          {m.detected_at_ch.toLocaleString("en-AU", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add missing record</DialogTitle>
          </DialogHeader>
          {addPayload && (
            <div className="space-y-3">
              <input type="hidden" value={addPayload.sectionId} readOnly />
              <div>
                <label className="drainer-label block mb-1">Chainage (CH)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={addChainage}
                  onChange={(e) => setAddChainage(e.target.value)}
                  placeholder="0.000"
                  className={`drainer-input ${addIsDuplicate ? "border-red-500 bg-red-50" : ""}`}
                />
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold min-h-[18px]">
                  {addChainageStatus === "checking" && (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      <span className="text-slate-500">Checking...</span>
                    </>
                  )}
                  {addChainageStatus === "exists" && (
                    <span className="text-red-500">EXISTS</span>
                  )}
                  {addChainageStatus === "clear" && !addIsDuplicate && (
                    <span className="text-green-600">CLEAR</span>
                  )}
                </div>
              </div>
              <div>
                <label className="drainer-label block mb-1">Pipe ID / Fitting</label>
                <Input
                  value={addPipeFittingId}
                  onChange={(e) => setAddPipeFittingId(e.target.value)}
                  placeholder="e.g. 000615-000550 or TEE DN1600"
                  className="drainer-input"
                />
              </div>
              <div>
                <label className="drainer-label block mb-1">Joint Type</label>
                <Select value={addJointType} onValueChange={setAddJointType}>
                  <SelectTrigger className="drainer-input">
                    <SelectValue placeholder="Select joint type" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOINT_TYPES.map((j) => (
                      <SelectItem key={j.value} value={j.value}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="drainer-label block mb-1">Vertical Deflection (mm)</label>
                <div className="flex gap-2">
                  <select
                    value={addDeflectionVSign}
                    onChange={(e) =>
                      setAddDeflectionVSign(e.target.value as "+" | "-")
                    }
                    className="drainer-input w-20"
                  >
                    <option value="+">+</option>
                    <option value="-">−</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="0"
                    value={addDeflectionVMm}
                    onChange={(e) => setAddDeflectionVMm(e.target.value)}
                    className="drainer-input flex-1"
                  />
                </div>
                {addVInvalid && (
                  <p className="mt-1 text-xs font-bold text-red-500">
                    Out of tolerance (Max. 50mm)
                  </p>
                )}
              </div>
              <div>
                <label className="drainer-label block mb-1">Horizontal Deflection (mm)</label>
                <div className="flex gap-2">
                  <select
                    value={addDeflectionHSide}
                    onChange={(e) =>
                      setAddDeflectionHSide(e.target.value as "L" | "R")
                    }
                    className="drainer-input w-20"
                  >
                    <option value="L">Left</option>
                    <option value="R">Right</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="0"
                    value={addDeflectionHMm}
                    onChange={(e) => setAddDeflectionHMm(e.target.value)}
                    className="drainer-input flex-1"
                  />
                </div>
                {addHInvalid && (
                  <p className="mt-1 text-xs font-bold text-red-500">
                    Out of tolerance (Max. 100mm)
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                  Pre-Lodge Checklist
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      id: "witness",
                      checked: addWitnessMark,
                      set: setAddWitnessMark,
                      label: "Pipe installed up to Witness Mark",
                    },
                    {
                      id: "seal",
                      checked: addInternalSeal,
                      set: setAddInternalSeal,
                      label: "Internal Seal Visual Inspection",
                    },
                    {
                      id: "ovality",
                      checked: addOvalityCheck,
                      set: setAddOvalityCheck,
                      label: "Ovality Check Done",
                    },
                    {
                      id: "liner",
                      checked: addCementLiner,
                      set: setAddCementLiner,
                      label: "Cement Liner Visual Check",
                    },
                    {
                      id: "spark",
                      checked: addSparkTesting,
                      set: setAddSparkTesting,
                      label: "Spark Testing Done",
                    },
                    ...(addShowCpLugs
                      ? [
                          {
                            id: "cp",
                            checked: addCpLugs,
                            set: setAddCpLugs,
                            label: "CP lugs installed @12 O'clock & Lead Connected",
                          },
                        ]
                      : []),
                    ...(addShowJointAirTest
                      ? [
                          {
                            id: "air",
                            checked: addJointAirTest,
                            set: setAddJointAirTest,
                            label: "Joint Air Test (80kPa, 2 min)",
                          },
                        ]
                      : []),
                  ].map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[var(--border)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        className="mt-1 w-5 h-5"
                      />
                      <span className="text-sm text-slate-700 leading-tight">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="drainer-label block mb-1">Inspector Name (optional)</label>
                <Input
                  value={addInspectorName}
                  onChange={(e) => setAddInspectorName(e.target.value)}
                  className="drainer-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRecord}
              disabled={addLoading || !addFormValid}
            >
              {addLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
