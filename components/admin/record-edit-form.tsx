"use client";

import { useState, useEffect } from "react";
import { SignaturePad, SignaturePreview } from "@/components/signature-pad";
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

const JOINT_TYPES = ["RRJ", "WR", "WB", "CWB"] as const;

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
};

export function RecordEditForm({
  recordId,
  open,
  onClose,
  onSaved,
  getAccessToken,
}: RecordEditFormProps) {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<PipeRecord | null>(null);
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
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState("");
  const [signatureOpen, setSignatureOpen] = useState(false);

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
      setAiInsight(r.ai_insight ?? "");
      setSignatureData(
        r.signature_data && r.signature_data.startsWith("data:")
          ? r.signature_data
          : null
      );
    };

    load();
  }, [open, recordId, getAccessToken, pushToast]);

  const handleSave = async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        pushToast({ type: "error", title: "Sign in required" });
        setLoading(false);
        return;
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
          signature_data: signatureData || null,
          ai_insight: aiInsight || null,
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pipe Record</DialogTitle>
        </DialogHeader>

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
                className="drainer-input"
              />
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
              <select
                value={deflectionVSign}
                onChange={(e) => setDeflectionVSign(e.target.value as "+" | "-")}
                className="drainer-input w-14"
              >
                <option value="+">+</option>
                <option value="-">−</option>
              </select>
              <Input
                type="number"
                value={deflectionVMm}
                onChange={(e) => setDeflectionVMm(e.target.value)}
                className="drainer-input w-20"
              />
              <span className="text-sm">/</span>
              <select
                value={deflectionHSide}
                onChange={(e) => setDeflectionHSide(e.target.value as "L" | "R")}
                className="drainer-input w-14"
              >
                <option value="L">L</option>
                <option value="R">R</option>
              </select>
              <Input
                type="number"
                value={deflectionHMm}
                onChange={(e) => setDeflectionHMm(e.target.value)}
                className="drainer-input w-20"
              />
            </div>
          </div>

          {(jointType === "RRJ" || jointType === "WR") && (
            <div className="flex gap-4 flex-wrap">
              {jointType === "RRJ" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cpLugs ?? false}
                    onChange={(e) => setCpLugs(e.target.checked)}
                  />
                  CP Lugs @12
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={jointAirTest ?? false}
                  onChange={(e) => setJointAirTest(e.target.checked)}
                />
                Joint Air Test
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

          <div>
            <label className="drainer-label block mb-1">Signature</label>
{signatureData ? (
                <div className="flex items-center gap-2">
                <SignaturePreview dataUrl={signatureData} height={50} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSignatureOpen(true)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSignatureOpen(true)}
              >
                Add Signature
              </Button>
            )}
          </div>

          <div>
            <label className="drainer-label block mb-1">AI Insight</label>
            <Input
              value={aiInsight}
              onChange={(e) => setAiInsight(e.target.value)}
              className="drainer-input"
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {signatureOpen && (
        <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign</DialogTitle>
            </DialogHeader>
            <SignaturePad
              onSave={(base64DataUrl) => {
                setSignatureData(base64DataUrl);
                setSignatureOpen(false);
              }}
              onCancel={() => setSignatureOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
