"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AdminNav } from "@/components/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Pencil, Trash2 } from "lucide-react";

const PROXIMITY_M = 24;
const TYPE_COLORS: Record<string, string> = {
  Fitting: "bg-blue-500 text-white",
  Structural: "bg-orange-500 text-white",
  Warning: "bg-red-500 text-white",
  Info: "bg-gray-500 text-white",
};

type Checkpoint = {
  id: string;
  name: string;
  ch: number;
  type: string;
  active: boolean;
  notified: boolean;
  notified_at: string | null;
  alert_email: string | null;
};

function getStatus(
  cp: Checkpoint,
  maxCh: number | null
): "pendiente" | "proximo" | "superado" {
  if (maxCh == null) return "pendiente";
  if (maxCh >= cp.ch) return "superado";
  const dist = cp.ch - maxCh;
  if (dist <= PROXIMITY_M && cp.active && !cp.notified) return "proximo";
  return "pendiente";
}

export default function CheckpointsPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [maxCh, setMaxCh] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ch, setCh] = useState("");
  const [type, setType] = useState<string>("Info");
  const [active, setActive] = useState(true);
  const [alertEmail, setAlertEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadCheckpoints = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/drainer/checkpoints", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (data.checkpoints) setCheckpoints(data.checkpoints);
  }, [getAccessToken]);

  const loadMaxCh = useCallback(async () => {
    const res = await fetch("/api/drainer/checkpoints/max-ch");
    const data = await res.json();
    setMaxCh(data.max_ch ?? null);
  }, []);

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
        loadCheckpoints();
        loadMaxCh();
      }
    };
    check();
  }, [authEmail, getAccessToken, loadCheckpoints, loadMaxCh]);

  const openCreate = () => {
    setModalMode("create");
    setEditId(null);
    setName("");
    setCh("");
    setType("Info");
    setActive(true);
    setAlertEmail("");
    setModalOpen(true);
  };

  const openEdit = (cp: Checkpoint) => {
    setModalMode("edit");
    setEditId(cp.id);
    setName(cp.name);
    setCh(String(cp.ch));
    setType(cp.type);
    setActive(cp.active);
    setAlertEmail(cp.alert_email ?? "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      pushToast({ type: "error", title: "Nombre requerido" });
      return;
    }
    const chNum = parseFloat(ch);
    if (Number.isNaN(chNum)) {
      pushToast({ type: "error", title: "CH debe ser un número" });
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const payload = { name: name.trim(), ch: chNum, type, active, alert_email: alertEmail.trim() || null };
      const url =
        modalMode === "edit" && editId
          ? `/api/drainer/checkpoints/${editId}`
          : "/api/drainer/checkpoints";
      const method = modalMode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      pushToast({ type: "success", title: "Checkpoint guardado" });
      setModalOpen(false);
      loadCheckpoints();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar checkpoint?")) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/checkpoints/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error");
      pushToast({ type: "success", title: "Checkpoint eliminado" });
      loadCheckpoints();
    } catch {
      pushToast({ type: "error", title: "Error al eliminar" });
    }
  };

  const handleToggleActive = async (cp: Checkpoint) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/checkpoints/${cp.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !cp.active }),
      });
      if (!res.ok) throw new Error("Error");
      loadCheckpoints();
    } catch {
      pushToast({ type: "error", title: "Error al actualizar" });
    }
  };

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
          <h1 className="drainer-title text-xl">Checkpoints</h1>
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
      <div className="drainer-shell max-w-3xl">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="drainer-title text-xl">Checkpoints</h1>
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
            <CardTitle className="text-sm">Checkpoints del trazado</CardTitle>
            <Button size="sm" onClick={openCreate} className="drainer-button drainer-button-primary">
              Agregar
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--muted-foreground)] mb-3">
              CH actual máximo: {maxCh != null ? maxCh.toLocaleString("en-AU", { minimumFractionDigits: 2 }) : "—"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-2">Nombre</th>
                    <th className="text-left py-2 px-2">CH</th>
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-left py-2 px-2">Estado</th>
                    <th className="text-left py-2 px-2">Alerta a</th>
                    <th className="text-left py-2 px-2">Activo</th>
                    <th className="text-right py-2 px-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((cp) => {
                    const status = getStatus(cp, maxCh);
                    return (
                      <tr key={cp.id} className="border-b border-[var(--border)]/50">
                        <td className="py-2 px-2 font-medium">{cp.name}</td>
                        <td className="py-2 px-2">
                          {Number(cp.ch).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={TYPE_COLORS[cp.type] ?? "bg-gray-500 text-white"}>
                            {cp.type}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          {status === "superado" && <span>✅ Superado</span>}
                          {status === "proximo" && <span>🟡 Próximo</span>}
                          {status === "pendiente" && <span>⚪ Pendiente</span>}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {cp.alert_email ? cp.alert_email : <span className="text-[var(--muted-foreground)]">Global</span>}
                        </td>
                        <td className="py-2 px-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(cp)}
                            className={`text-xs px-2 py-1 rounded ${cp.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                          >
                            {cp.active ? "Sí" : "No"}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEdit(cp)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDelete(cp.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {checkpoints.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">
                No hay checkpoints. Agregá uno para recibir alertas cuando la instalación se aproxime.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? "Agregar checkpoint" : "Editar checkpoint"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="drainer-label block mb-1">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Cruce con gas"
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">CH</label>
              <Input
                type="number"
                step="0.01"
                value={ch}
                onChange={(e) => setCh(e.target.value)}
                placeholder="Ej: 2841.86"
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="drainer-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fitting">Fitting</SelectItem>
                  <SelectItem value="Structural">Structural</SelectItem>
                  <SelectItem value="Warning">Warning</SelectItem>
                  <SelectItem value="Info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="drainer-label block mb-1">Email de alerta</label>
              <Input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="tu@email.com"
                className="drainer-input"
              />
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                Si no se completa, se usará el mail global configurado en el servidor
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="active" className="text-sm">Activo</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
