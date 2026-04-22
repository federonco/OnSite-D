"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { AdminNav } from "@/components/admin-nav";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Trash2 } from "lucide-react";
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

const DASHBOARD_HOME = "https://apa-dashboard.readx.com.au/admin";

type SectionRow = {
  id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  projects: { name: string | null; number: string | null } | null;
  itp_number: string | null;
};

type SubsectionRow = {
  id: string;
  section_id: string;
  app_id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  is_active: boolean;
  app_config?: Record<string, unknown> | null;
};

function guideItemsFromConfig(
  appConfig: Record<string, unknown> | null | undefined
): { sequence_number: number; item_id: string }[] {
  const raw = appConfig?.guide_xml;
  if (!Array.isArray(raw)) return [];
  const out: { sequence_number: number; item_id: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const seq = Number(o.sequence_number);
    const item = typeof o.item_id === "string" ? o.item_id.trim() : "";
    if (!Number.isFinite(seq) || !item) continue;
    out.push({ sequence_number: seq, item_id: item });
  }
  out.sort((a, b) => a.sequence_number - b.sequence_number);
  return out;
}

function rebalanceGuideSequences(
  rows: { sequence_number: number; item_id: string }[],
  editedIndex: number,
  desiredSequence: number
): { sequence_number: number; item_id: string }[] {
  const targetSeq = Math.max(1, Math.trunc(Number(desiredSequence) || 1));
  const indexed = rows.map((row, idx) => ({
    idx,
    row: {
      ...row,
      sequence_number:
        idx === editedIndex
          ? targetSeq
          : Math.max(1, Math.trunc(Number(row.sequence_number) || 1)),
    },
  }));

  const used = new Set<number>([targetSeq]);
  const assigned = new Map<number, { sequence_number: number; item_id: string }>();

  assigned.set(editedIndex, {
    ...indexed[editedIndex].row,
    sequence_number: targetSeq,
  });

  const others = indexed
    .filter((x) => x.idx !== editedIndex)
    .sort((a, b) =>
      a.row.sequence_number === b.row.sequence_number
        ? a.idx - b.idx
        : a.row.sequence_number - b.row.sequence_number
    );

  for (const item of others) {
    let next = item.row.sequence_number;
    while (used.has(next)) next += 1;
    used.add(next);
    assigned.set(item.idx, {
      ...item.row,
      sequence_number: next,
    });
  }

  return rows.map((_, idx) => assigned.get(idx) ?? rows[idx]);
}

function formatChainage(s: SectionRow): string {
  if (s.start_ch == null && s.end_ch == null) return "—";
  if (s.start_ch != null && s.end_ch != null) {
    return `${s.start_ch} → ${s.end_ch}`;
  }
  if (s.start_ch != null) return String(s.start_ch);
  return String(s.end_ch);
}

function crewLabel(s: SectionRow): string {
  const p = s.projects;
  if (!p) return "—";
  const name = p.name?.trim();
  const num = p.number?.trim();
  if (name && num) return `${name} (${num})`;
  return name || num || "—";
}

function scopeLabel(s: SectionRow): string {
  const parts = [s.itp_number?.trim(), s.direction?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function AdminSectionsReadonlyPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [subsections, setSubsections] = useState<SubsectionRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SubsectionRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [formStartCh, setFormStartCh] = useState("");
  const [formEndCh, setFormEndCh] = useState("");
  const [formDirection, setFormDirection] = useState<string>("onwards");
  const [formActive, setFormActive] = useState(true);
  const [formExpectedEnabled, setFormExpectedEnabled] = useState(false);
  const [formGuideRows, setFormGuideRows] = useState<
    { sequence_number: number; item_id: string }[]
  >([]);
  const [initialGuideRows, setInitialGuideRows] = useState<
    { sequence_number: number; item_id: string }[]
  >([]);

  const guideRowsChanged =
    JSON.stringify(formGuideRows) !== JSON.stringify(initialGuideRows);

  const handleResequenceGuideRows = () => {
    if (formGuideRows.length === 0 || !guideRowsChanged) return;
    const ok = window.confirm(
      "Resequence guide rows now? This will re-number all rows from 1 in order."
    );
    if (!ok) return;
    setFormGuideRows((prev) => {
      const sorted = [...prev].sort(
        (a, b) => Number(a.sequence_number) - Number(b.sequence_number)
      );
      return sorted.map((row, idx) => ({
        ...row,
        sequence_number: idx + 1,
      }));
    });
  };

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token ?? null;
  }, [supabase]);

  const loadSections = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/drainer/sections", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json()) as {
      sections?: SectionRow[];
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
  }, [getAccessToken, pushToast]);

  const loadSubsections = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/drainer/subsections", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json()) as {
      subsections?: SubsectionRow[];
      error?: string;
    };
    if (!res.ok) {
      pushToast({
        type: "error",
        title: "Could not load subsections",
        message: data.error ?? res.statusText,
      });
      return;
    }
    if (!Array.isArray(data.subsections)) {
      pushToast({
        type: "error",
        title: "Invalid subsections response",
        message: "Expected a subsections array from the server.",
      });
      return;
    }
    setSubsections(data.subsections);
  }, [getAccessToken, pushToast]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthEmail(data.session?.user.email ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!authEmail) {
      setIsAdmin(null);
      return;
    }
    const check = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/drainer/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      setIsAdmin(json.isAdmin ?? false);
      if (json.isAdmin) {
        loadSections();
        loadSubsections();
      }
    };
    check();
  }, [authEmail, getAccessToken, loadSections, loadSubsections]);

  const openEditSubsection = (s: SubsectionRow) => {
    const guideRows = guideItemsFromConfig(s.app_config);
    setEditing(s);
    setFormName(s.name);
    setFormSectionId(s.section_id);
    setFormStartCh(s.start_ch != null ? String(s.start_ch) : "");
    setFormEndCh(s.end_ch != null ? String(s.end_ch) : "");
    setFormDirection(s.direction ?? "onwards");
    setFormActive(Boolean(s.is_active));
    setFormExpectedEnabled(Boolean((s.app_config as Record<string, unknown> | null)?.guide_enabled));
    setFormGuideRows(guideRows);
    setInitialGuideRows(guideRows);
    setEditOpen(true);
  };

  const saveSubsection = async () => {
    if (!editing) return;
    if (!formName.trim()) {
      pushToast({ type: "error", title: "Name required" });
      return;
    }
    if (!formSectionId) {
      pushToast({ type: "error", title: "Parent section required" });
      return;
    }
    setSaving(true);
    try {
      const token = await getAccessToken();
      const existingAppConfig =
        (editing.app_config as Record<string, unknown> | null) ?? {};
      const guideItems = formGuideRows
        .filter((r) => Number.isFinite(Number(r.sequence_number)) && String(r.item_id).trim() !== "")
        .map((r) => ({
          sequence_number: Number(r.sequence_number),
          item_id: String(r.item_id).trim(),
        }))
        .sort((a, b) => a.sequence_number - b.sequence_number);
      const nextAppConfig: Record<string, unknown> = {
        ...existingAppConfig,
        guide_enabled: formExpectedEnabled,
        guide_xml: formExpectedEnabled ? guideItems : null,
      };
      const res = await fetch(`/api/drainer/subsections/${editing.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formName.trim(),
          section_id: formSectionId,
          start_ch: formStartCh.trim() ? Number(formStartCh) : null,
          end_ch: formEndCh.trim() ? Number(formEndCh) : null,
          direction: formDirection || null,
          is_active: formActive,
          app_config: nextAppConfig,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      pushToast({ type: "success", title: "Subsection updated" });
      setEditOpen(false);
      setEditing(null);
      loadSubsections();
    } catch (err) {
      pushToast({
        type: "error",
        title: "Update failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const loadingState = authEmail !== null && isAdmin === null;

  if (loadingState) {
    return (
      <div className="drainer-page">
        <div className="drainer-shell">
          <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authEmail) {
    return (
      <div className="drainer-page">
        <div className="drainer-shell">
          <div className="drainer-header">
            <h1 className="drainer-title text-xl">Admin sign in</h1>
            <AuthPanel onAuthChange={setAuthEmail} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="drainer-page">
        <div className="drainer-shell">
          <div className="drainer-header">
            <h1 className="drainer-title text-xl">Admin sign in</h1>
            <AuthPanel onAuthChange={setAuthEmail} />
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mt-4">
            Access denied. Your email is not in the admin allowlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="drainer-page">
      <div className="drainer-shell max-w-4xl">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="drainer-title text-xl">Sections (read-only)</h1>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="sm" className="h-9 text-xs">
                  Back to User
                </Button>
              </Link>
            </div>
          </div>
          <AuthPanel onAuthChange={setAuthEmail} />
        </div>

        <AdminNav />

        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4 mb-4 text-sm text-[var(--ink)] space-y-2"
          role="status"
        >
          <p className="font-medium flex items-center gap-2">
            <span aria-hidden>ℹ️</span>
            Sections are managed from the Admin Dashboard.
          </p>
          <p className="text-[var(--muted-foreground)]">
            Open Admin Dashboard {"->"} apa-dashboard.readx.com.au/admin ·
            OnSite-D manages subsections only.
          </p>
          <div>
            <a
              href={DASHBOARD_HOME}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[#B8682A] hover:underline"
            >
              Open Admin Dashboard
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>

        <Card className="drainer-card">
          <CardContent className="pt-4">
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--surface-alt)] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Chainage</th>
                    <th className="px-3 py-2 font-medium">Crew / project</th>
                    <th className="px-3 py-2 font-medium">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sections.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-[var(--muted-foreground)]"
                      >
                        No sections loaded.
                      </td>
                    </tr>
                  ) : (
                    sections.map((s) => (
                      <tr key={s.id} className="hover:bg-[var(--surface-alt)]/60">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2 tabular-nums">{formatChainage(s)}</td>
                        <td className="px-3 py-2">{crewLabel(s)}</td>
                        <td className="px-3 py-2">{scopeLabel(s)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="drainer-card mt-4">
          <CardContent className="pt-4">
            <div className="drainer-title mb-3">Subsections (editable)</div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--surface-alt)] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Parent section</th>
                    <th className="px-3 py-2 font-medium">Chainage</th>
                    <th className="px-3 py-2 font-medium">Direction</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {subsections.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-[var(--muted-foreground)]"
                      >
                        No subsections loaded.
                      </td>
                    </tr>
                  ) : (
                    subsections.map((s) => {
                      const parent =
                        sections.find((sec) => sec.id === s.section_id)?.name ?? "—";
                      const chainage =
                        s.start_ch != null && s.end_ch != null
                          ? `${s.start_ch} → ${s.end_ch}`
                          : s.start_ch != null
                          ? String(s.start_ch)
                          : s.end_ch != null
                          ? String(s.end_ch)
                          : "—";
                      return (
                        <tr key={s.id} className="hover:bg-[var(--surface-alt)]/60">
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2">{parent}</td>
                          <td className="px-3 py-2 tabular-nums">{chainage}</td>
                          <td className="px-3 py-2">{s.direction ?? "—"}</td>
                          <td className="px-3 py-2">{s.is_active ? "Active" : "Inactive"}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditSubsection(s)}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit subsection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="drainer-label block mb-1">Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">Parent section</label>
              <Select value={formSectionId} onValueChange={setFormSectionId}>
                <SelectTrigger className="drainer-input">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="drainer-label block mb-1">Start CH</label>
                <Input
                  type="number"
                  value={formStartCh}
                  onChange={(e) => setFormStartCh(e.target.value)}
                  className="drainer-input"
                />
              </div>
              <div>
                <label className="drainer-label block mb-1">End CH</label>
                <Input
                  type="number"
                  value={formEndCh}
                  onChange={(e) => setFormEndCh(e.target.value)}
                  className="drainer-input"
                />
              </div>
            </div>
            <div>
              <label className="drainer-label block mb-1">Direction</label>
              <Select value={formDirection} onValueChange={setFormDirection}>
                <SelectTrigger className="drainer-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onwards">Onwards</SelectItem>
                  <SelectItem value="backwards">Backwards</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
              />
              Active
            </label>
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formExpectedEnabled}
                  onChange={(e) => setFormExpectedEnabled(e.target.checked)}
                />
                Enable EXPECTED preload
              </label>
              <div>
                <label className="drainer-label block mb-1">
                  Expected preload values (guide)
                </label>
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-alt)] text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Sequence #</th>
                        <th className="px-3 py-2 text-left font-medium">Item ID</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {formGuideRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={Number.isFinite(Number(row.sequence_number)) ? String(row.sequence_number) : ""}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (!Number.isFinite(n)) return;
                                setFormGuideRows((prev) =>
                                  rebalanceGuideSequences(prev, idx, n)
                                );
                              }}
                              className="drainer-input"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={row.item_id}
                              onChange={(e) => {
                                const v = e.target.value;
                                setFormGuideRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, item_id: v } : r
                                  )
                                );
                              }}
                              className="drainer-input"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setFormGuideRows((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormGuideRows((prev) => [
                        ...prev,
                        {
                          sequence_number:
                            prev.length > 0
                              ? Math.max(...prev.map((r) => Number(r.sequence_number) || 0)) + 1
                              : 1,
                          item_id: "",
                        },
                      ])
                    }
                  >
                    Add row
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResequenceGuideRows}
                    disabled={formGuideRows.length === 0 || !guideRowsChanged}
                  >
                    Resequence
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSubsection} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
