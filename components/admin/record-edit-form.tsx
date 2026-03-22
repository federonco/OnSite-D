"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const JOINT_TYPES = ["RRJ", "WR", "Transition"] as const;

export type PipeRecord = {
  id: string;
  section_id: string | null;
  date_installed: string | null;
  time_installed: string | null;
  chainage: number;
  pipe_fitting_id: string | null;
  joint_type: string | null;
  witness_mark: boolean | null;
  internal_seal: boolean | null;
  deflection_v_sign: string | null;
  deflection_v_mm: number | null;
  deflection_h_side: string | null;
  deflection_h_mm: number | null;
  cp_lugs: boolean | null;
  ovality_check: boolean | null;
  joint_air_test: boolean | null;
  cement_liner: boolean | null;
  spark_testing: boolean | null;
  inspector_name: string | null;
  signature_data: string | null;
  ai_insight: string | null;
};

type RecordEditFormProps = {
  recordId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  getAccessToken: () => Promise<string | null>;
  /** Optional note shown above the form (e.g. Data Validation context) */
  contextualNote?: string | null;
  /** CH range context (e.g. from inconsistency or fitting card) */
  contextChFrom?: number | null;
  contextChTo?: number | null;
  /** When editing from inconsistency, the "to" record id for CH final updates */
  contextRecordToId?: string | null;
};

export function RecordEditForm({
  recordId,
  open,
  onClose,
  onSaved,
  getAccessToken,
  contextualNote,
  contextChFrom,
  contextChTo,
  contextRecordToId,
}: RecordEditFormProps) {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [record, setRecord] = useState<PipeRecord | null>(null);
  const [isDuplicateChainage, setIsDuplicateChainage] = useState(false);
  const [dateInstalled, setDateInstalled] = useState("");
  const [timeInstalled, setTimeInstalled] = useState("");
  const [chainage, setChainage] = useState("");
  const [pipeFittingId, setPipeFittingId] = useState("");
  const [jointType, setJointType] = useState("");
  const [witnessMark, setWitnessMark] = useState(false);
  const [internalSeal, setInternalSeal] = useState(false);
  const [deflectionVSign, setDeflectionVSign] = useState<"+" | "-">("+");
  const [deflectionVMm, setDeflectionVMm] = useState("");
  const [deflectionHSide, setDeflectionHSide] = useState<"L" | "R">("L");
  const [deflectionHMm, setDeflectionHMm] = useState("");
  const [cpLugs, setCpLugs] = useState<boolean | null>(null);
  const [ovalityCheck, setOvalityCheck] = useState(false);
  const [jointAirTest, setJointAirTest] = useState<boolean | null>(null);
  const [cementLiner, setCementLiner] = useState(false);
  const [sparkTesting, setSparkTesting] = useState(false);
  const [inspectorName, setInspectorName] = useState("");
  const [contextChToLocal, setContextChToLocal] = useState("");

  useEffect(() => {
    if (open && contextChTo != null) {
      setContextChToLocal(String(contextChTo));
    }
  }, [open, contextChTo]);

  useEffect(() => {
    if (!open || !recordId) return;

    const load = async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/drainer/records/${recordId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast({ type: "error", title: "Failed to load record" });
        return;
      }
      const r = data.record as PipeRecord;
      setRecord(r);
      setDateInstalled(r.date_installed ?? "");
      setTimeInstalled(r.time_installed ?? "");
      setChainage(String(r.chainage ?? ""));
      setPipeFittingId(r.pipe_fitting_id ?? "");
      setJointType(r.joint_type ?? "");
      setWitnessMark(r.witness_mark ?? false);
      setInternalSeal(r.internal_seal ?? false);
      setDeflectionVSign((r.deflection_v_sign as "+" | "-") ?? "+");
      setDeflectionVMm(String(r.deflection_v_mm ?? ""));
      setDeflectionHSide((r.deflection_h_side as "L" | "R") ?? "L");
      setDeflectionHMm(String(r.deflection_h_mm ?? ""));
      setCpLugs(r.cp_lugs ?? null);
      setOvalityCheck(r.ovality_check ?? false);
      setJointAirTest(r.joint_air_test ?? null);
      setCementLiner(r.cement_liner ?? false);
      setSparkTesting(r.spark_testing ?? false);
      setInspectorName(r.inspector_name ?? "");
    };

    load();
  }, [open, recordId, getAccessToken, pushToast]);

  const checkDuplicateChainage = useCallback(async () => {
    const sectionId = record?.section_id;
    if (!sectionId || !chainage || !recordId) {
      setIsDuplicateChainage(false);
      return;
    }
    const ch = Number(chainage);
    if (!Number.isFinite(ch)) {
      setIsDuplicateChainage(false);
      return;
    }
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/drainer/records/check-duplicate?sectionId=${sectionId}&chainage=${ch}&excludeRecordId=${recordId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await res.json();
      setIsDuplicateChainage(!!data.duplicate);
    } catch {
      setIsDuplicateChainage(false);
    }
  }, [record?.section_id, chainage, recordId, getAccessToken]);

  useEffect(() => {
    if (!record?.section_id || !chainage) {
      setIsDuplicateChainage(false);
      return;
    }
    const timer = setTimeout(checkDuplicateChainage, 400);
    return () => clearTimeout(timer);
  }, [record?.section_id, chainage, checkDuplicateChainage]);

  const handleSave = async () => {
    if (!recordId || isDuplicateChainage) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        pushToast({ type: "error", title: "Sign in required" });
        setLoading(false);
        return;
      }

      if (contextRecordToId && contextChTo != null && contextChToLocal.trim()) {
        const chToNum = parseFloat(contextChToLocal);
        if (Number.isFinite(chToNum) && Math.abs(chToNum - contextChTo) > 0.001) {
          const resTo = await fetch(`/api/drainer/records/${contextRecordToId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ chainage: chToNum }),
          });
          if (!resTo.ok) {
            const dataTo = await resTo.json();
            throw new Error(dataTo.error ?? "Failed to update CH final");
          }
        }
      }

      const res = await fetch(`/api/drainer/records/${recordId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date_installed: dateInstalled || null,
          time_installed: timeInstalled || null,
          chainage: chainage ? Number(chainage) : null,
          pipe_fitting_id: pipeFittingId || null,
          joint_type: jointType || null,
          witness_mark: witnessMark,
          internal_seal: internalSeal,
          deflection_v_sign: deflectionVSign || null,
          deflection_v_mm: deflectionVMm ? Number(deflectionVMm) : null,
          deflection_h_side: deflectionHSide || null,
          deflection_h_mm: deflectionHMm ? Number(deflectionHMm) : null,
          cp_lugs: cpLugs,
          ovality_check: ovalityCheck,
          joint_air_test: jointAirTest,
          cement_liner: cementLiner,
          spark_testing: sparkTesting,
          inspector_name: inspectorName || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      pushToast({ type: "success", title: "Record updated" });
      onSaved();
      onClose();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !recordId ||
      !window.confirm(
        "Are you sure you want to delete this record? This action cannot be undone."
      )
    )
      return;
    setDeleting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        pushToast({ type: "error", title: "Sign in required" });
        setDeleting(false);
        return;
      }
      const res = await fetch(`/api/drainer/records/${recordId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      pushToast({ type: "success", title: "Record deleted" });
      onSaved();
      onClose();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pipe Record</DialogTitle>
        </DialogHeader>

        {contextualNote && (
          <p className="text-sm font-medium bg-[#FFF6DB] text-[#9A6B00] border border-[#F3E3B0] rounded-full px-2.5 py-1.5">
            {contextualNote}
          </p>
        )}

        {(contextChFrom != null || contextChTo != null) && (
          <div className="flex gap-4 flex-wrap items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted-foreground)]">CH inicial:</span>
              <Input
                type="number"
                step="0.01"
                value={chainage}
                onChange={(e) => setChainage(e.target.value)}
                className="drainer-input w-24 h-9"
                placeholder="—"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted-foreground)]">CH final:</span>
              <Input
                type="number"
                step="0.01"
                value={contextChTo != null ? (contextRecordToId ? contextChToLocal : chainage) : ""}
                onChange={(e) => contextRecordToId ? setContextChToLocal(e.target.value) : setChainage(e.target.value)}
                className="drainer-input w-24 h-9"
                placeholder="—"
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="drainer-label block mb-1">Date Installed</label>
              <Input
                type="date"
                value={dateInstalled}
                onChange={(e) => setDateInstalled(e.target.value)}
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">Time</label>
              <Input
                value={timeInstalled}
                onChange={(e) => setTimeInstalled(e.target.value)}
                className="drainer-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="drainer-label block mb-1">Chainage</label>
              <Input
                type="number"
                value={chainage}
                onChange={(e) => setChainage(e.target.value)}
                className={`drainer-input ${isDuplicateChainage ? "!border-red-500 !bg-red-50" : ""}`}
                aria-invalid={!!isDuplicateChainage}
              />
              {isDuplicateChainage && (
                <p className="mt-1 text-xs font-bold text-red-500">
                  A record at Ch {chainage} already exists for this location.
                </p>
              )}
            </div>
            <div>
              <label className="drainer-label block mb-1">Pipe No / Fitting ID</label>
              <Input
                value={pipeFittingId}
                onChange={(e) => setPipeFittingId(e.target.value)}
                className="drainer-input"
              />
            </div>
          </div>

          <div>
            <label className="drainer-label block mb-1">Joint Type</label>
            <Select value={jointType} onValueChange={setJointType}>
              <SelectTrigger className="drainer-input">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {JOINT_TYPES.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={witnessMark}
                onChange={(e) => setWitnessMark(e.target.checked)}
              />
              Witness Mark
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={internalSeal}
                onChange={(e) => setInternalSeal(e.target.checked)}
              />
              Internal Seal
            </label>
          </div>

          <div>
            <label className="drainer-label block mb-1">Deflection V/H</label>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={deflectionVSign}
                onValueChange={(v) => setDeflectionVSign(v as "+" | "-")}
              >
                <SelectTrigger className="drainer-input w-14 h-10 min-h-10 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+">+</SelectItem>
                  <SelectItem value="-">−</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={deflectionVMm}
                onChange={(e) => setDeflectionVMm(e.target.value)}
                className="drainer-input w-20"
              />
              <span className="text-sm">/</span>
              <Select
                value={deflectionHSide}
                onValueChange={(v) => setDeflectionHSide(v as "L" | "R")}
              >
                <SelectTrigger className="drainer-input w-14 h-10 min-h-10 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="R">R</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={deflectionHMm}
                onChange={(e) => setDeflectionHMm(e.target.value)}
                className="drainer-input w-20"
              />
            </div>
          </div>

          {(jointType === "RRJ") && (
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cpLugs ?? false}
                  onChange={(e) => setCpLugs(e.target.checked)}
                />
                CP Lugs @12
              </label>
            </div>
          )}

          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ovalityCheck}
                onChange={(e) => setOvalityCheck(e.target.checked)}
              />
              Ovality Check
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cementLiner}
                onChange={(e) => setCementLiner(e.target.checked)}
              />
              Cement Liner
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sparkTesting}
                onChange={(e) => setSparkTesting(e.target.checked)}
              />
              Spark Testing
            </label>
          </div>

          <div>
            <label className="drainer-label block mb-1">Inspector Name</label>
            <Input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="drainer-input"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || deleting || !recordId}
            className="drainer-button-delete-soft min-h-[44px] mr-auto"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || isDuplicateChainage}
              className="min-h-[44px] bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
