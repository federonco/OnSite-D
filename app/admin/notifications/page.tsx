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

const JOINT_TYPES = [
  { value: "RRJ", label: "RRJ" },
  { value: "WR", label: "WR" },
  { value: "WB", label: "WB" },
  { value: "CWB", label: "CWB" },
];

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
    setAddInspectorName("");
    setAddModalOpen(true);
  };

  const handleAddRecord = async () => {
    if (!addPayload) return;
    const ch = parseFloat(addChainage);
    if (!Number.isFinite(ch)) {
      pushToast({ type: "error", title: "Chainage inválido" });
      return;
    }
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
          inspector_name: addInspectorName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      pushToast({ type: "success", title: "Registro agregado" });
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
    chFrom: number,
    chTo: number
  ) => {
    const chMin = Math.max(0, chFrom - 1);
    const chMax = chTo + 1;
    router.push(
      `/admin/records/${sectionId}?chMin=${chMin}&chMax=${chMax}`
    );
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
          <h1 className="drainer-title text-xl">Notificaciones</h1>
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
            <h1 className="drainer-title text-xl">Notificaciones</h1>
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
              ⚠️ Inconsistencias de Registros
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInconsistencies}
              disabled={inconsistenciesLoading}
            >
              {inconsistenciesLoading ? "Cargando…" : "Actualizar"}
            </Button>
          </CardHeader>
          <CardContent>
            {inconsistenciesLoading ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4">
                Cargando…
              </p>
            ) : !hasInconsistencies ? (
              <p className="text-sm text-green-600 py-4">
                ✅ Sin inconsistencias detectadas
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2">Sección</th>
                      <th className="text-left py-2 px-2">CH anterior</th>
                      <th className="text-left py-2 px-2">ID anterior</th>
                      <th className="text-left py-2 px-2">CH siguiente</th>
                      <th className="text-left py-2 px-2">ID siguiente</th>
                      <th className="text-left py-2 px-2">Diferencia</th>
                      <th className="text-left py-2 px-2">Tipo</th>
                      <th className="text-left py-2 px-2">Acciones</th>
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
                              : "🟡 Solapamiento <12m"}
                          </span>
                          {(inc.inferred_type_from === "fitting" ||
                            inc.inferred_type_to === "fitting") && (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-400 text-white">
                              Puede ser fitting
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 flex gap-1 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() =>
                              navigateToRecords(sec.section_id, inc.ch_from, inc.ch_to)
                            }
                          >
                            Ver registros
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => openAddModal(inc, sec)}
                          >
                            Agregar registro
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar registro faltante</DialogTitle>
          </DialogHeader>
          {addPayload && (
            <div className="space-y-3">
              <input
                type="hidden"
                value={addPayload.sectionId}
                readOnly
              />
              <div>
                <label className="drainer-label block mb-1">Chainage</label>
                <Input
                  type="number"
                  step="0.001"
                  value={addChainage}
                  onChange={(e) => setAddChainage(e.target.value)}
                  className="drainer-input"
                />
              </div>
              <div>
                <label className="drainer-label block mb-1">Pipe ID / Fitting</label>
                <Input
                  value={addPipeFittingId}
                  onChange={(e) => setAddPipeFittingId(e.target.value)}
                  placeholder="e.g. 000615-000550 o TEE DN1600"
                  className="drainer-input"
                />
              </div>
              <div>
                <label className="drainer-label block mb-1">Joint Type</label>
                <Select value={addJointType} onValueChange={setAddJointType}>
                  <SelectTrigger className="drainer-input">
                    <SelectValue placeholder="Seleccionar" />
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
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addWitnessMark}
                    onChange={(e) => setAddWitnessMark(e.target.checked)}
                  />
                  Witness Mark
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addInternalSeal}
                    onChange={(e) => setAddInternalSeal(e.target.checked)}
                  />
                  Internal Seal
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addOvalityCheck}
                    onChange={(e) => setAddOvalityCheck(e.target.checked)}
                  />
                  Ovality Check
                </label>
              </div>
              <div>
                <label className="drainer-label block mb-1">Inspector</label>
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
              Cancelar
            </Button>
            <Button onClick={handleAddRecord} disabled={addLoading}>
              {addLoading ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
