"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { SectionKebabMenu } from "@/components/section-kebab-menu";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const JOINT_TYPES = [
  { value: "RRJ", label: "RRJ (Rubber Ring Joint)" },
  { value: "WR", label: "WR (Weld Restricted)" },
  { value: "WB", label: "WB" },
  { value: "CWB", label: "CWB" },
] as const;

type Section = {
  id: string;
  name: string;
};

type LodgeFormProps = {
  sections: Section[];
  sectionId: string;
  onSectionChange: (id: string) => void;
  onSuccess?: () => void;
  /** Show kebab menu (Create/Edit/Audit/Print) - admin only */
  showKebabMenu?: boolean;
  onCreateSection?: () => void;
  onEditSection?: () => void;
  onAuditReport?: () => void;
  onPrintReport?: () => void;
};

type ChainageStatus = "idle" | "checking" | "exists" | "clear";

export function LodgeForm({
  sections,
  sectionId,
  onSectionChange,
  onSuccess,
  showKebabMenu = false,
  onCreateSection,
  onEditSection,
  onAuditReport,
  onPrintReport,
}: LodgeFormProps) {
  const { pushToast } = useToast();
  const supabase = getSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [dateInstalled] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [chainage, setChainage] = useState("");
  const [chainageStatus, setChainageStatus] = useState<ChainageStatus>("idle");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [pipeFittingId, setPipeFittingId] = useState("");
  const [jointType, setJointType] = useState<string>("");
  const [deflectionVSign, setDeflectionVSign] = useState<"+" | "-">("+");
  const [deflectionVMm, setDeflectionVMm] = useState("");
  const [deflectionHSide, setDeflectionHSide] = useState<"L" | "R">("L");
  const [deflectionHMm, setDeflectionHMm] = useState("");
  const [witnessMark, setWitnessMark] = useState(false);
  const [internalSeal, setInternalSeal] = useState(false);
  const [ovalityCheck, setOvalityCheck] = useState(false);
  const [cementLiner, setCementLiner] = useState(false);
  const [sparkTesting, setSparkTesting] = useState(false);
  const [cpLugs, setCpLugs] = useState(false);
  const [jointAirTest, setJointAirTest] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token ?? null;
  }, [supabase]);

  const checkDuplicate = useCallback(async () => {
    if (!sectionId || !chainage) {
      setChainageStatus("idle");
      setIsDuplicate(false);
      return;
    }
    const ch = Number(chainage);
    if (!Number.isFinite(ch)) {
      setChainageStatus("idle");
      return;
    }

    setChainageStatus("checking");
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/drainer/records/check-duplicate?sectionId=${sectionId}&chainage=${ch}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await res.json();
      const duplicate = !!data.duplicate;
      setIsDuplicate(duplicate);
      setChainageStatus(duplicate ? "exists" : "clear");
    } catch {
      setChainageStatus("idle");
    }
  }, [sectionId, chainage, getAccessToken]);

  useEffect(() => {
    if (!chainage) {
      setChainageStatus("idle");
      setIsDuplicate(false);
      return;
    }
    const timer = setTimeout(checkDuplicate, 400);
    return () => clearTimeout(timer);
  }, [chainage, sectionId, checkDuplicate]);

  const handleChainageBlur = () => {
    if (chainage) checkDuplicate();
  };

  const vMm = Math.abs(Number(deflectionVMm) || 0);
  const hMm = Math.abs(Number(deflectionHMm) || 0);
  const vInvalid = vMm > 50;
  const hInvalid = hMm > 100;

  const showCpLugs = jointType === "RRJ";
  const showJointAirTest = jointType === "RRJ" || jointType === "WR";

  useEffect(() => {
    if (!showCpLugs) setCpLugs(false);
    if (!showJointAirTest) setJointAirTest(false);
  }, [showCpLugs, showJointAirTest]);

  const allChecklistChecked =
    witnessMark &&
    internalSeal &&
    ovalityCheck &&
    cementLiner &&
    sparkTesting &&
    (showCpLugs ? cpLugs : true) &&
    (showJointAirTest ? jointAirTest : true);

  const isFormValid =
    !!sectionId &&
    !!chainage &&
    Number.isFinite(Number(chainage)) &&
    !!pipeFittingId.trim() &&
    !!jointType &&
    !vInvalid &&
    !hInvalid &&
    !isDuplicate &&
    allChecklistChecked;

  const resetForm = useCallback(() => {
    setChainage("");
    setChainageStatus("idle");
    setIsDuplicate(false);
    setPipeFittingId("");
    setJointType("");
    setDeflectionVSign("+");
    setDeflectionVMm("");
    setDeflectionHSide("L");
    setDeflectionHMm("");
    setWitnessMark(false);
    setInternalSeal(false);
    setOvalityCheck(false);
    setCementLiner(false);
    setSparkTesting(false);
    setCpLugs(false);
    setJointAirTest(false);
  }, []);

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        pushToast({ type: "error", title: "Sign in required" });
        setLoading(false);
        return;
      }

      const ch = Number(chainage);
      const res = await fetch("/api/drainer/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: sectionId,
          date_installed: dateInstalled,
          chainage: ch,
          pipe_fitting_id: pipeFittingId.trim(),
          joint_type: jointType,
          witness_mark: witnessMark,
          internal_seal: internalSeal,
          deflection_v_sign: deflectionVSign,
          deflection_v_mm: vMm,
          deflection_h_side: deflectionHSide,
          deflection_h_mm: hMm,
          cp_lugs: showCpLugs ? cpLugs : null,
          ovality_check: ovalityCheck,
          joint_air_test: showJointAirTest ? jointAirTest : null,
          cement_liner: cementLiner,
          spark_testing: sparkTesting,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to lodge record");

      pushToast({ type: "success", title: "Record lodged successfully" });
      resetForm();
      onSuccess?.();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Lodge failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId),
    [sections, sectionId]
  );

  return (
    <>
      <Card className="drainer-card">
        <CardHeader>
          <CardTitle className="drainer-title">Pipe Laying Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 1. Section selector + kebab (admin only) */}
          <div>
            <label className="drainer-label block mb-1">Section</label>
            <div className="flex gap-2 items-center">
              <Select
                value={sectionId}
                onValueChange={(v) => {
                  onSectionChange(v);
                  setChainageStatus("idle");
                  setIsDuplicate(false);
                }}
              >
                <SelectTrigger className="drainer-input flex-1">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showKebabMenu && (
                <SectionKebabMenu
                  sectionId={sectionId}
                  sectionName={selectedSection?.name ?? ""}
                  onCreate={onCreateSection ?? (() => {})}
                  onEdit={onEditSection ?? (() => {})}
                  onAuditReport={onAuditReport ?? (() => {})}
                  onPrint={onPrintReport ?? (() => {})}
                />
              )}
            </div>
          </div>

          {/* 2. Chainage + Pipe ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="drainer-label block mb-1">Chainage (CH)</label>
              <Input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={chainage}
                onChange={(e) => setChainage(e.target.value)}
                onBlur={handleChainageBlur}
                className={`drainer-input ${isDuplicate ? "border-red-500 bg-red-50" : ""}`}
              />
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold min-h-[18px]">
                {chainageStatus === "checking" && (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    <span className="text-slate-500">Checking...</span>
                  </>
                )}
                {chainageStatus === "exists" && (
                  <span className="text-red-500">EXISTS</span>
                )}
                {chainageStatus === "clear" && !isDuplicate && (
                  <span className="text-green-600">CLEAR</span>
                )}
              </div>
            </div>
            <div>
              <label className="drainer-label block mb-1">Pipe ID / Fitting</label>
              <Input
                type="text"
                placeholder="e.g. 000615 / 45d Bend"
                value={pipeFittingId}
                onChange={(e) => setPipeFittingId(e.target.value)}
                className="drainer-input"
              />
            </div>
          </div>

          {/* 4. Joint Type (before deflection per reference) */}
          <div>
            <label className="drainer-label block mb-1">Joint Type</label>
            <Select value={jointType} onValueChange={setJointType}>
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

          {/* 5. Vertical Deflection */}
          <div>
            <label className="drainer-label block mb-1">
              Vertical Deflection (mm)
            </label>
            <div className="flex gap-2">
              <select
                value={deflectionVSign}
                onChange={(e) =>
                  setDeflectionVSign(e.target.value as "+" | "-")
                }
                className="drainer-input w-20"
              >
                <option value="+">+</option>
                <option value="-">−</option>
              </select>
              <Input
                type="number"
                placeholder="0"
                value={deflectionVMm}
                onChange={(e) => setDeflectionVMm(e.target.value)}
                className="drainer-input flex-1"
              />
            </div>
            {vInvalid && (
              <p className="mt-1 text-xs font-bold text-red-500">
                Out of tolerance (Max. 50mm)
              </p>
            )}
          </div>

          {/* 6. Horizontal Deflection */}
          <div>
            <label className="drainer-label block mb-1">
              Horizontal Deflection (mm)
            </label>
            <div className="flex gap-2">
              <select
                value={deflectionHSide}
                onChange={(e) =>
                  setDeflectionHSide(e.target.value as "L" | "R")
                }
                className="drainer-input w-20"
              >
                <option value="L">Left</option>
                <option value="R">Right</option>
              </select>
              <Input
                type="number"
                placeholder="0"
                value={deflectionHMm}
                onChange={(e) => setDeflectionHMm(e.target.value)}
                className="drainer-input flex-1"
              />
            </div>
            {hInvalid && (
              <p className="mt-1 text-xs font-bold text-red-500">
                Out of tolerance (Max. 100mm)
              </p>
            )}
          </div>

          {/* 7. Checklist */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              Pre-Lodge Checklist
            </h3>
            <div className="space-y-2">
              {[
                {
                  id: "witness",
                  checked: witnessMark,
                  set: setWitnessMark,
                  label: "Pipe installed up to Witness Mark",
                },
                {
                  id: "seal",
                  checked: internalSeal,
                  set: setInternalSeal,
                  label: "Internal Seal Visual Inspection",
                },
                {
                  id: "ovality",
                  checked: ovalityCheck,
                  set: setOvalityCheck,
                  label: "Ovality Check Done",
                },
                {
                  id: "liner",
                  checked: cementLiner,
                  set: setCementLiner,
                  label: "Cement Liner Visual Check",
                },
                {
                  id: "spark",
                  checked: sparkTesting,
                  set: setSparkTesting,
                  label: "Spark Testing Done",
                },
                ...(showCpLugs
                  ? [
                      {
                        id: "cp",
                        checked: cpLugs,
                        set: setCpLugs,
                        label:
                          "CP lugs installed @12 O'clock & Lead Connected",
                      },
                    ]
                  : []),
                ...(showJointAirTest
                  ? [
                      {
                        id: "air",
                        checked: jointAirTest,
                        set: setJointAirTest,
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

          {/* 8. Lodge button */}
          <ConfirmButton
            label={loading ? "Lodging..." : "LODGE PIPE RECORD"}
            confirmLabel="Confirm?"
            onConfirm={handleSubmit}
            disabled={loading || !isFormValid}
            className="drainer-button drainer-button-primary w-full py-4 text-lg font-bold disabled:bg-slate-300 disabled:cursor-not-allowed"
          />
        </CardContent>
      </Card>

    </>
  );
}
