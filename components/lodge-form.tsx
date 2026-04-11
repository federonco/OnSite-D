"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeGuideXmlFromJsonb,
  type GuideXmlEntry,
} from "@/lib/installation-guide-xml";
import { ConfirmButton } from "@/components/confirm-button";
import { SectionKebabMenu } from "@/components/section-kebab-menu";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const JOINT_TYPES = [
  { value: "RRJ", label: "RRJ (Rubber Ring Joint)" },
  { value: "WR", label: "WR (Weld Restrained)" },
  { value: "Transition", label: "Transition" },
  { value: "WB", label: "WB (Weld Band)" },
] as const;

type Section = {
  id: string;
  name: string;
  /** Allowed joint types for this section (null/empty = all types). */
  joint_types?: string[] | null;
  guide_enabled?: boolean;
  guide_xml?: { sequence_number: number; item_id: string }[] | null;
};

type LodgeFormProps = {
  sections: Section[];
  sectionId: string;
  onSectionChange: (id: string) => void;
  onSuccess?: () => void;
  /** Initial chainage from QR/deep-link (triggers validation on load) */
  initialCh?: string | null;
  /** Show kebab menu (Create/Edit/Audit/Print) - admin only */
  showKebabMenu?: boolean;
  onCreateSection?: () => void;
  onEditSection?: () => void;
  onAuditReport?: () => void;
  onPrintReport?: () => void;
};

type ChainageStatus = "idle" | "checking" | "exists" | "clear";

/** Validates CH: numeric with up to 2 decimal places. Returns error message or null. */
function validateChainage(value: string): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "Must be a positive number";
  const match = value.trim().match(/^\d+(\.\d{0,2})?$/);
  if (!match) return "Up to 2 decimal places allowed";
  return null;
}

export function LodgeForm({
  sections,
  sectionId,
  onSectionChange,
  onSuccess,
  initialCh,
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
  const [chainageError, setChainageError] = useState<string | null>(null);
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
  const [guideRefreshKey, setGuideRefreshKey] = useState(0);
  const [guideRefLoading, setGuideRefLoading] = useState(false);
  const [guideRefData, setGuideRefData] = useState<{
    nextSequence: number;
    item: GuideXmlEntry | null;
  } | null>(null);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId),
    [sections, sectionId]
  );

  const jointTypeSyncedForSectionId = useRef<string | null>(null);

  const lodgeJointSelectOptions = useMemo(() => {
    const raw = selectedSection?.joint_types;
    const catalog = JOINT_TYPES.map((j) => ({ value: j.value, label: j.label }));
    if (!raw || raw.length === 0) return catalog;
    const set = new Set(raw);
    const fromCatalog = catalog.filter((j) => set.has(j.value));
    const known = new Set<string>(JOINT_TYPES.map((j) => j.value));
    const extras = raw
      .filter((x) => x && !known.has(x))
      .map((x) => ({ value: x, label: x }));
    return [...fromCatalog, ...extras];
  }, [selectedSection]);

  const defaultJointTypeForSection = useMemo(
    () => lodgeJointSelectOptions[0]?.value ?? "",
    [lodgeJointSelectOptions]
  );

  /** Prefill joint type when the section changes or section list first loads. */
  useEffect(() => {
    if (!sectionId) {
      setJointType("");
      jointTypeSyncedForSectionId.current = null;
      return;
    }
    if (!selectedSection) return;
    if (jointTypeSyncedForSectionId.current === sectionId) return;
    jointTypeSyncedForSectionId.current = sectionId;
    setJointType(defaultJointTypeForSection);
  }, [sectionId, selectedSection, defaultJointTypeForSection]);

  useEffect(() => {
    if (!jointType || lodgeJointSelectOptions.length === 0) return;
    if (!lodgeJointSelectOptions.some((o) => o.value === jointType)) {
      setJointType(lodgeJointSelectOptions[0].value);
    }
  }, [lodgeJointSelectOptions, jointType]);

  useEffect(() => {
    if (!sectionId) {
      setGuideRefData(null);
      setGuideRefLoading(false);
      return;
    }
    const sec = selectedSection;
    if (
      !sec?.guide_enabled ||
      sec.guide_xml == null
    ) {
      setGuideRefData(null);
      setGuideRefLoading(false);
      return;
    }
    const list = normalizeGuideXmlFromJsonb(sec.guide_xml);
    if (!list?.length) {
      setGuideRefData(null);
      setGuideRefLoading(false);
      return;
    }
    let cancelled = false;
    setGuideRefLoading(true);
    setGuideRefData(null);
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from("drainer_pipe_records")
        .select("counter")
        .eq("section_id", sectionId)
        .order("counter", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      let nextSequence = 1;
      if (
        data != null &&
        data.counter != null &&
        Number.isFinite(Number(data.counter))
      ) {
        nextSequence = Number(data.counter) + 1;
      }
      const item =
        list.find((x) => x.sequence_number === nextSequence) ?? null;
      setGuideRefData({ nextSequence, item });
      setGuideRefLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionId, selectedSection, guideRefreshKey]);

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
    if (initialCh != null && initialCh !== "" && sectionId) {
      setChainage(initialCh);
    }
  }, [initialCh, sectionId]);

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
    setChainageError(validateChainage(chainage));
    if (chainage) checkDuplicate();
  };

  const handleChainageChange = (value: string) => {
    setChainage(value);
    setChainageError(null);
  };

  const vMm = Math.abs(Number(deflectionVMm) || 0);
  const hMm = Math.abs(Number(deflectionHMm) || 0);
  const vInvalid = vMm > 50;
  const hInvalid = hMm > 100;

  const showCpLugs = jointType === "RRJ" || jointType === "Transition";

  useEffect(() => {
    if (!showCpLugs) setCpLugs(false);
  }, [showCpLugs]);

  const allChecklistChecked =
    witnessMark &&
    internalSeal &&
    ovalityCheck &&
    cementLiner &&
    sparkTesting &&
    (showCpLugs ? cpLugs : true);

  const jointTypeAllowed = lodgeJointSelectOptions.some(
    (o) => o.value === jointType
  );

  const isFormValid =
    !!sectionId &&
    !!chainage &&
    !chainageError &&
    Number.isFinite(Number(chainage)) &&
    !!pipeFittingId.trim() &&
    !!jointType &&
    jointTypeAllowed &&
    !vInvalid &&
    !hInvalid &&
    chainageStatus !== "checking" &&
    !isDuplicate &&
    allChecklistChecked;

  const resetForm = useCallback(() => {
    setChainage("");
    setChainageStatus("idle");
    setChainageError(null);
    setIsDuplicate(false);
    setPipeFittingId("");
    const sec = sections.find((s) => s.id === sectionId);
    const raw = sec?.joint_types;
    const catalog = JOINT_TYPES.map((j) => j.value);
    if (!raw || raw.length === 0) {
      setJointType(catalog[0] ?? "");
    } else {
      const first =
        JOINT_TYPES.find((j) => raw.includes(j.value))?.value ?? raw[0] ?? "";
      setJointType(first);
    }
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
  }, [sections, sectionId]);

  const handleSubmit = async () => {
    const submitError = validateChainage(chainage);
    if (submitError) {
      setChainageError(submitError);
      pushToast({ type: "error", title: "Invalid chainage", message: submitError });
      return;
    }
    if (!isFormValid) return;

    setLoading(true);
    try {
      const token = await getAccessToken();
      const ch = Number(chainage);
      const res = await fetch("/api/drainer/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          joint_air_test: null,
          cement_liner: cementLiner,
          spark_testing: sparkTesting,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to lodge record");

      pushToast({ type: "success", title: "Record lodged successfully" });
      resetForm();
      setGuideRefreshKey((k) => k + 1);
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

  return (
    <>
      <Card className="drainer-card">
        <CardContent className="pt-0">
          <div className="drainer-title">Location</div>
          <div className="flex gap-2 items-center mt-[14px] mb-[2px]">
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
        </CardContent>
      </Card>

      <Card className="drainer-card drainer-card-chainage">
        <CardContent className="pt-0">
          <div className="drainer-title">
            Current chainage (ch)
          </div>
          <div className="relative mt-[14px] mb-[2px] w-full">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={chainage}
              onChange={(e) => handleChainageChange(e.target.value)}
              onBlur={handleChainageBlur}
              className={`drainer-input drainer-nums-plain-zero h-9 min-h-9 pr-14 pl-14 text-center rounded-full font-semibold ${
                isDuplicate || chainageError ? "!border-red-500 !bg-red-50" : ""
              } ${isDuplicate ? "text-red-500" : ""}`}
              aria-invalid={!!chainageError || !!isDuplicate}
              aria-describedby={chainageError ? "chainage-error" : undefined}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="drainer-stepper-btn absolute left-[-2px] top-1/2 z-10 size-9 min-w-9 min-h-9 -translate-y-1/2 rounded-full shrink-0"
              onClick={() => {
                const n = parseFloat(chainage) || 0;
                const next = Math.max(0, n - 1);
                handleChainageChange(next.toFixed(2));
                setChainageError(null);
              }}
            >
              −
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="drainer-stepper-btn absolute right-[-2px] top-1/2 z-10 size-9 min-w-9 min-h-9 -translate-y-1/2 rounded-full shrink-0"
              onClick={() => {
                const n = parseFloat(chainage) || 0;
                const next = n + 1;
                handleChainageChange(next.toFixed(2));
                setChainageError(null);
              }}
            >
              +
            </Button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            {chainageStatus === "checking" && (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">Checking for overlaps</span>
              </>
            )}
            {chainageStatus === "clear" && chainage && (
              <>
                <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                <span className="text-green-600">OK</span>
              </>
            )}
            {chainageStatus === "exists" && (
              <>
                <XCircle className="size-3.5 shrink-0 text-red-500" />
                <span className="font-bold text-red-500 drainer-nums-plain-zero">
                  A record at Ch {chainage} already exists for this location.
                </span>
              </>
            )}
          </div>
          {chainageError && (
            <p id="chainage-error" className="mt-1 text-xs font-bold text-red-500">
              {chainageError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="drainer-card">
        <CardContent className="pt-0">
          <div className="drainer-title mb-2">Pipe ID / fitting</div>
          {sectionId &&
            selectedSection?.guide_enabled === true &&
            selectedSection.guide_xml != null &&
            !guideRefLoading &&
            guideRefData &&
            (guideRefData.item ? (
              <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                  Expected
                </p>
                <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                  <p className="text-sm font-semibold text-stone-700 min-w-0">
                    Item — {guideRefData.item.item_id}
                  </p>
                  <p className="text-[11px] text-stone-500 text-right shrink-0 whitespace-nowrap leading-snug">
                    Write Item reference + pipe number below
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                  Expected
                </p>
                <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                  <p className="text-sm text-stone-400 min-w-0">
                    Item — no reference for this position
                  </p>
                  <p className="text-[11px] text-stone-500 text-right shrink-0 whitespace-nowrap leading-snug">
                    Write Item reference + pipe number below
                  </p>
                </div>
              </div>
            ))}
          <div className="mt-0">
          <Input
            type="text"
            placeholder="e.g. 000615 / 45d Bend"
            value={pipeFittingId}
            onChange={(e) => setPipeFittingId(e.target.value)}
            className="drainer-input"
          />
          </div>
        </CardContent>
      </Card>

      <Card className="drainer-card">
        <CardContent className="pt-0">
          <div className="drainer-title">Joints</div>
          <div className="mt-2 space-y-4">
          <div>
            <Select value={jointType} onValueChange={setJointType}>
              <SelectTrigger className="drainer-input">
                <SelectValue placeholder="Select joint type" />
              </SelectTrigger>
              <SelectContent>
                {lodgeJointSelectOptions.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vertical Deflection */}
          <div>
            <label className="drainer-label block mb-1">
              Vertical deflection (mm)
            </label>
            <div className="flex gap-2">
              <Select
                value={deflectionVSign}
                onValueChange={(v) => setDeflectionVSign(v as "+" | "-")}
              >
                <SelectTrigger className="drainer-input drainer-input-sm w-20 h-10 min-h-10 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+">+</SelectItem>
                  <SelectItem value="-">−</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0"
                value={deflectionVMm}
                onChange={(e) => setDeflectionVMm(e.target.value)}
                className="drainer-input drainer-nums-plain-zero flex-1"
              />
            </div>
            {vInvalid && (
              <p className="mt-1 text-xs font-bold text-red-500">
                Out of tolerance (Max. 50mm)
              </p>
            )}
          </div>

          {/* Horizontal Deflection */}
          <div>
            <label className="drainer-label block mb-1">
              Horizontal deflection (mm)
            </label>
            <div className="flex gap-2">
              <Select
                value={deflectionHSide}
                onValueChange={(v) => setDeflectionHSide(v as "L" | "R")}
              >
                <SelectTrigger className="drainer-input drainer-input-sm w-20 h-10 min-h-10 rounded-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Left</SelectItem>
                  <SelectItem value="R">Right</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0"
                value={deflectionHMm}
                onChange={(e) => setDeflectionHMm(e.target.value)}
                className="drainer-input drainer-nums-plain-zero flex-1"
              />
            </div>
            {hInvalid && (
              <p className="mt-1 text-xs font-bold text-red-500">
                Out of tolerance (Max. 100mm)
              </p>
            )}
          </div>
          </div>
        </CardContent>
      </Card>

      <Card className="drainer-card">
        <CardContent className="pt-0">
          <div className="drainer-title">Pre-lodge checklist</div>
          <div className="mt-2 space-y-2">
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
                  label: "Internal seal visual inspection",
                },
                {
                  id: "ovality",
                  checked: ovalityCheck,
                  set: setOvalityCheck,
                  label: "Ovality check done",
                },
                {
                  id: "liner",
                  checked: cementLiner,
                  set: setCementLiner,
                  label: "Cement liner visual check",
                },
                {
                  id: "spark",
                  checked: sparkTesting,
                  set: setSparkTesting,
                  label: "Spark testing done",
                },
                ...(showCpLugs
                  ? [
                      {
                        id: "cp",
                        checked: cpLugs,
                        set: setCpLugs,
                        label:
                          "CP lugs installed @12 O'clock & lead connected",
                      },
                    ]
                  : []),
              ].map((item) => (
                <label
                  key={item.id}
                  className="drainer-checklist-item"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.set(e.target.checked)}
                    className="drainer-checkbox w-5 h-5 shrink-0"
                  />
                  <span className="drainer-checklist-label leading-tight">
                    {item.label}
                  </span>
                </label>
              ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmButton
        label={loading ? "Lodging..." : "Lodge record"}
        confirmLabel="Confirm?"
        onConfirm={handleSubmit}
        disabled={loading || !isFormValid}
        className="drainer-button drainer-button-primary drainer-button-lodge w-full py-4 text-base font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
      />
    </>
  );
}
