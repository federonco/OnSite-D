"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";

const EXPIRED_DAYS = 14;

type Checkpoint = {
  id: string;
  name: string;
  chainage: number;
  type: string;
  is_active: boolean;
  notified: boolean;
  last_notified: string | null;
  alert_email: string | null;
};

type Section = {
  id: string;
  name: string;
};

function isNotifiedOlderThanDays(notifiedAt: string | null, days: number): boolean {
  if (!notifiedAt) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(notifiedAt) < cutoff;
}

export default function CheckpointsPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [printSectionId, setPrintSectionId] = useState<string>("all");
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
  const [printing, setPrinting] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadSections = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/drainer/sections", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json()) as {
      sections?: Section[];
      error?: string;
    };
    if (!res.ok) {
      pushToast({
        type: "error",
        title: "Could not load sections",
        message: data.error ?? res.statusText,
      });
      return;
    }
    if (!Array.isArray(data.sections)) {
      pushToast({
        type: "error",
        title: "Invalid sections response",
        message: "Expected a sections array from the server.",
      });
      return;
    }
    setSections(data.sections);
    setPrintSectionId((prev) =>
      data.sections!.find((s: Section) => s.id === prev)?.id ?? ""
    );
  }, [getAccessToken, pushToast]);

  const loadCheckpoints = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/drainer/checkpoints", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    let list: Checkpoint[] = data.checkpoints ?? [];
    const expiredIds = new Set<string>();

    for (const cp of list) {
      if (
        cp.notified &&
        cp.last_notified &&
        isNotifiedOlderThanDays(cp.last_notified, EXPIRED_DAYS)
      ) {
        try {
          const archiveRes = await fetch("/api/drainer/checkpoints/archive", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              checkpoint_id: cp.id,
              section_id: null,
              name: cp.name,
              chainage: cp.chainage,
              type: cp.type,
              alert_email: cp.alert_email,
              last_notified: cp.last_notified,
            }),
          });
          if (!archiveRes.ok) {
            const err = await archiveRes.json();
            console.error("checkpoint_history insert failed:", err);
          }
        } catch (e) {
          console.error("checkpoint_history insert failed:", e);
        }

        const putRes = await fetch(`/api/drainer/checkpoints/${cp.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_active: false,
            notified: false,
            last_notified: null,
          }),
        });
        if (putRes.ok) expiredIds.add(cp.id);
      }
    }

    list = list.filter((cp: Checkpoint) => !expiredIds.has(cp.id));
    setCheckpoints(list);
    if (expiredIds.size > 0) {
      pushToast({
        type: "success",
        title: `${expiredIds.size} checkpoint(s) auto-expired and archived.`,
      });
    }
  }, [getAccessToken, pushToast]);

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
        loadSections();
      }
    };
    check();
  }, [authEmail, getAccessToken, loadCheckpoints, loadMaxCh, loadSections]);

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
    setCh(String(cp.chainage));
    setType(cp.type);
    setActive(cp.is_active);
    setAlertEmail(cp.alert_email ?? "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      pushToast({ type: "error", title: "Name required" });
      return;
    }
    const chNum = parseFloat(ch);
    if (Number.isNaN(chNum)) {
      pushToast({ type: "error", title: "CH must be a number" });
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const payload = {
        name: name.trim(),
        chainage: chNum,
        type,
        is_active: active,
        alert_email: alertEmail.trim() || null,
      };
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
      pushToast({ type: "success", title: "Checkpoint saved" });
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
    if (!confirm("Delete checkpoint?")) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/checkpoints/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error");
      pushToast({ type: "success", title: "Checkpoint deleted" });
      loadCheckpoints();
    } catch {
      pushToast({ type: "error", title: "Error deleting" });
    }
  };

  const handlePrintCheckpointRecord = async () => {
    setPrinting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/checkpoints/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section_id: (printSectionId && printSectionId !== "all") ? printSectionId : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.focus();
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      pushToast({ type: "error", title: "Error generating checkpoint record" });
    } finally {
      setPrinting(false);
    }
  };

  const handleResetNotification = async (cp: Checkpoint) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/checkpoints/${cp.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notified: false }),
      });
      if (!res.ok) throw new Error("Error");
      pushToast({ type: "success", title: "Notification reset" });
      loadCheckpoints();
    } catch {
      pushToast({ type: "error", title: "Error resetting" });
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
          <CardContent className="pt-0">
            <div className="drainer-title">Route checkpoints</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select
                value={printSectionId}
                onValueChange={setPrintSectionId}
              >
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={openCreate} className="min-h-[44px] px-4 border-0 bg-[#E8D2BF] text-[var(--ink)] hover:bg-[#DDC7B0]">
                Add
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] px-4 border-0 drainer-button-accent"
                onClick={handlePrintCheckpointRecord}
                disabled={printing}
              >
                {printing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Print Record"
                )}
              </Button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-6 mb-4">
              Current max CH: {maxCh != null ? maxCh.toLocaleString("en-AU", { minimumFractionDigits: 2 }) : "—"}
            </p>
            {checkpoints.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">
                No checkpoints. Add one to receive alerts when the installation approaches.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {checkpoints.map((cp) => {
                  const statusBadge =
                    cp.is_active === false
                      ? (
                          <span className="drainer-badge-inactive shrink-0">
                            <span className="drainer-badge-inactive-dot" aria-hidden />
                            Inactive
                          </span>
                        )
                      : cp.is_active && cp.notified
                        ? <span className="drainer-badge-orange shrink-0">Notified ✓</span>
                        : <span className="drainer-badge-orange shrink-0">Active</span>;
                  return (
                    <div
                      key={cp.id}
                      className="rounded-xl border border-[var(--border)] bg-[#E8D2BF] p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-bold text-sm">{cp.name}</span>
                        {statusBadge}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold">CH {Number(cp.chainage).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                        <span className="drainer-badge-orange">
                          {cp.type}
                        </span>
                      </div>
                      {cp.alert_email && (
                        <p className="text-xs text-[var(--muted-foreground)] mb-3">Alert to: {cp.alert_email}</p>
                      )}
                      <div className="flex flex-wrap gap-2 justify-between items-center w-full">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="drainer-button-delete-soft min-h-[44px] px-4"
                            onClick={() => handleDelete(cp.id)}
                          >
                            Delete
                          </Button>
                          {cp.notified && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] min-w-[44px] px-4"
                              onClick={() => handleResetNotification(cp)}
                            >
                              Reset notification
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] px-4 bg-[#B8682A] text-white border-0 hover:bg-[#A35D26] shrink-0"
                          onClick={() => openEdit(cp)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? "Add checkpoint" : "Edit checkpoint"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="drainer-label block mb-1">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gas crossing"
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
                placeholder="e.g. 2841.86"
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">Type</label>
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
              <label className="drainer-label block mb-1">Alert email</label>
              <Input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="you@example.com"
                className="drainer-input"
              />
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                If left empty, the global email configured on the server will be used
              </p>
            </div>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded w-5 h-5"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="min-h-[44px] bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]">
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
