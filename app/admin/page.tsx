"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import {
  ITR_PAGE_SIZE,
  getITRProgress,
  groupRecordsIntoITRs,
} from "@/lib/drainer";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2 } from "lucide-react";

type Section = {
  id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  project_name: string | null;
  project_number: string | null;
  itp_number: string | null;
};

type RecordRow = {
  id: string;
  chainage: number;
  date_installed: string | null;
};

export default function AdminPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startCh, setStartCh] = useState("");
  const [endCh, setEndCh] = useState("");
  const [direction, setDirection] = useState<string>("onwards");
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [itpNumber, setItpNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [printingItrIndex, setPrintingItrIndex] = useState<number | null>(null);
  const [printingAudit, setPrintingAudit] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<
    "itr-complete" | "itr-open" | "audit" | null
  >(null);
  const [reportModalPayload, setReportModalPayload] = useState<{
    itrIndex?: number;
    recordCount?: number;
  } | null>(null);
  const [reportEmail, setReportEmail] = useState("");
  const [reportDefaultEmail, setReportDefaultEmail] = useState("");
  const [sendQROpen, setSendQROpen] = useState(false);
  const [sendQREmail, setSendQREmail] = useState("");
  const [sendingQR, setSendingQR] = useState(false);
  const [recordsRefreshing, setRecordsRefreshing] = useState(false);

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
    const data = await res.json();
    if (data.sections) {
      setSections(data.sections);
      setSectionId((prev) => {
        const next = data.sections.find((s: Section) => s.id === prev)?.id;
        return next ?? (data.sections[0]?.id ?? "");
      });
    }
  }, [getAccessToken]);

  const loadRecords = useCallback(async () => {
    if (!sectionId) return;
    const token = await getAccessToken();
    const res = await fetch(`/api/drainer/records?sectionId=${sectionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    setRecords(data.records ?? []);
  }, [sectionId, getAccessToken]);

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
      if (json.reportDefaultEmail ?? json.email)
        setReportDefaultEmail(json.reportDefaultEmail || json.email || "");
      if (json.isAdmin) loadSections();
    };
    check();
  }, [authEmail, getAccessToken, loadSections]);

  useEffect(() => {
    if (sectionId && isAdmin) loadRecords();
    else setRecords([]);
  }, [sectionId, isAdmin, loadRecords]);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId),
    [sections, sectionId]
  );

  const itrBlocks = useMemo(() => {
    const pages = groupRecordsIntoITRs(records);
    return pages.map((page, i) => {
      const status = page.length === ITR_PAGE_SIZE ? "READY" : "OPEN";
      const range =
        page.length > 0
          ? `${page[0].chainage} → ${page[page.length - 1].chainage}`
          : "—";
      const pendingCount = ITR_PAGE_SIZE - page.length;
      const progressPercent = Math.round((page.length / ITR_PAGE_SIZE) * 100);
      return {
        index: i + 1,
        status,
        range,
        recordCount: page.length,
        pendingCount,
        progressPercent,
        chainages: page.map((r) => r.chainage),
      };
    });
  }, [records]);

  const progress = useMemo(
    () => getITRProgress(records.length),
    [records.length]
  );

  const openCreate = () => {
    setModalMode("create");
    setEditId(null);
    setName("");
    setStartCh("");
    setEndCh("");
    setDirection("onwards");
    setProjectName("");
    setProjectNumber("");
    setItpNumber("");
    setModalOpen(true);
  };

  const openEdit = (s: Section) => {
    setModalMode("edit");
    setEditId(s.id);
    setName(s.name);
    setStartCh(s.start_ch != null ? String(s.start_ch) : "");
    setEndCh(s.end_ch != null ? String(s.end_ch) : "");
    setDirection(s.direction ?? "onwards");
    setProjectName(s.project_name ?? "");
    setProjectNumber(s.project_number ?? "");
    setItpNumber(s.itp_number ?? "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      pushToast({ type: "error", title: "Name required" });
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        pushToast({ type: "error", title: "Sign in required" });
        setLoading(false);
        return;
      }
      const payload = {
        name,
        start_ch: startCh ? Number(startCh) : null,
        end_ch: endCh ? Number(endCh) : null,
        direction: direction || null,
        project_name: projectName || null,
        project_number: projectNumber || null,
        itp_number: itpNumber || null,
      };
      const url =
        modalMode === "edit" && editId
          ? `/api/drainer/sections/${editId}`
          : "/api/drainer/sections";
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
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      pushToast({ type: "success", title: "Section saved" });
      setModalOpen(false);
      loadSections();
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

  const handleSendQR = async () => {
    if (!sectionId || !sendQREmail.trim()) return;
    setSendingQR(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch("/api/drainer/sections/send-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sectionId,
          recipientEmail: sendQREmail.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      pushToast({
        type: "success",
        title: "QR sent",
        message: `PDF sent to ${sendQREmail.trim()}`,
      });
      setSendQROpen(false);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Send failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSendingQR(false);
    }
  };

  const openReportModal = (
    type: "itr-complete" | "itr-open" | "audit",
    payload: { itrIndex?: number; recordCount?: number }
  ) => {
    if ((type === "itr-complete" || type === "itr-open") && (payload.recordCount ?? 0) > ITR_PAGE_SIZE) {
      pushToast({
        type: "error",
        title: "Too many records",
        message: `ITR-PLA-001 supports a maximum of ${ITR_PAGE_SIZE} rows per page. This ITR has ${payload.recordCount ?? 0} records.`,
      });
      return;
    }
    setReportModalType(type);
    setReportModalPayload(payload);
    setReportEmail(reportDefaultEmail || authEmail || "");
    setReportModalOpen(true);
  };

  const handleSendReport = async () => {
    if (!sectionId || !reportModalType || !reportEmail.trim()) return;
    const token = await getAccessToken();
    if (!token) {
      pushToast({ type: "error", title: "Sign in required" });
      return;
    }
    if (reportModalType === "itr-complete" || reportModalType === "itr-open") {
      setPrintingItrIndex(reportModalPayload?.itrIndex ?? null);
    } else {
      setPrintingAudit(true);
    }
    try {
      const email = reportEmail.trim();
      if (reportModalType === "audit") {
        const res = await fetch("/api/drainer/sections/audit/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sectionId, recipientEmail: email }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Send failed");
        pushToast({
          type: "success",
          title: "Audit report sent",
          message: `Report sent to ${email}`,
        });
      } else {
        const res = await fetch("/api/drainer/report/itr-pla-001/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sectionId,
            itrIndex: reportModalPayload?.itrIndex,
            recipientEmail: email,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Send failed");
        const isOpen = reportModalType === "itr-open";
        pushToast({
          type: "success",
          title: isOpen ? "Open ITR report sent" : "Email sent",
          message: isOpen
            ? `Open ITR report sent to ${email}`
            : "The PDF was emailed to your admin account.",
        });
      }
      setReportModalOpen(false);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Send failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setPrintingItrIndex(null);
      setPrintingAudit(false);
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
      <div className="drainer-shell max-w-2xl">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="drainer-title text-xl">Drainer Admin Center</h1>
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-9 text-xs">
                Back to Lodge
              </Button>
            </Link>
          </div>
          <AuthPanel onAuthChange={setAuthEmail} />
        </div>

        <AdminNav />

        <Card className="drainer-card">
          <CardContent className="pt-0">
            <div className="drainer-title">Section</div>
            <div className="mt-2 flex items-center gap-2">
            <Select
              value={sectionId || undefined}
              onValueChange={setSectionId}
            >
              <SelectTrigger className="drainer-input w-full">
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
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] px-4 text-sm shrink-0"
              onClick={() => {
                setSendQREmail(reportDefaultEmail || authEmail || "");
                setSendQROpen(true);
              }}
              disabled={!sectionId}
            >
              Send QR
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] px-0 bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]">
                  ⋮
                </Button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openCreate}>
                  Create Section
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => selectedSection && openEdit(selectedSection)}
                  disabled={!sectionId}
                >
                  Edit Section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {selectedSection && (
          <Card className="drainer-card">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm">
                    {selectedSection.name} — ITR Reports
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Link href={`/admin/records/${sectionId}`}>
                      <Button variant="outline" size="sm" className="min-h-[44px] px-4 text-sm">
                        View records
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] px-4 text-sm border-0 drainer-button-accent"
                      onClick={() => openReportModal("audit", {})}
                      disabled={!sectionId || printingAudit}
                    >
                      {printingAudit ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin shrink-0 mr-1" />
                          Sending…
                        </>
                      ) : (
                        "Print audit"
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-[var(--card-bg)] border-0 hover:bg-[var(--surface)]"
                  onClick={async () => {
                    setRecordsRefreshing(true);
                    await loadRecords();
                    setRecordsRefreshing(false);
                  }}
                  disabled={recordsRefreshing}
                  title="Refresh"
                >
                  <RefreshCw className={`size-4 ${recordsRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-[var(--muted-foreground)]">
                  Records: {records.length} (max {ITR_PAGE_SIZE} per ITR)
                </p>
                <span className="drainer-badge-orange">
                  Ready {progress.completeITRs}
                </span>
                <span className="drainer-badge-orange">
                  Open {progress.currentOpenCount > 0 ? 1 : 0}
                </span>
              </div>
              <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-1">
                <span>ITR progress</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {itrBlocks.length > 0 ? (
                <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {itrBlocks.map((block) => (
                    <div
                      key={block.index}
                      className="drainer-admin-report-card"
                    >
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          ITR-{block.index}
                        </p>
                        <p className="text-sm font-semibold">{block.range}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          Status:{" "}
                          <span
                            className={`inline-flex rounded-[var(--radius)] px-2 py-0.5 text-xs font-semibold ${
                              block.status === "READY"
                                ? "drainer-badge-orange"
                                : "drainer-badge-orange"
                            }`}
                          >
                            {block.status === "READY"
                              ? "Complete"
                              : `${block.recordCount} / 9 records`}
                          </span>
                        </p>
                        {block.status === "OPEN" && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                              <span>Complete</span>
                              <span>{block.progressPercent}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
                              <div
                                className="h-full rounded-full bg-[#8B6A53]"
                                style={{ width: `${block.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {block.status === "READY" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] px-4 text-sm border-0 drainer-button-accent"
                          onClick={() =>
                            openReportModal("itr-complete", {
                              itrIndex: block.index,
                              recordCount: block.recordCount,
                            })
                          }
                          disabled={printingItrIndex !== null}
                        >
                          {printingItrIndex === block.index ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              Sending…
                            </>
                          ) : (
                            `Print ITR-${block.index}`
                          )}
                        </Button>
                      ) : block.status === "OPEN" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] px-4 text-sm border-0 drainer-button-accent"
                          onClick={() =>
                            openReportModal("itr-open", {
                              itrIndex: block.index,
                              recordCount: block.recordCount,
                            })
                          }
                          disabled={printingItrIndex !== null}
                        >
                          {printingItrIndex === block.index ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              Sending…
                            </>
                          ) : (
                            `Print Open ITR (${block.recordCount} records)`
                          )}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                  No records yet. Lodge records from the main page.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create" ? "Create Section" : "Edit Section"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="drainer-label block mb-1">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Section name"
                className="drainer-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="drainer-label block mb-1">Start CH</label>
                <Input
                  type="number"
                  value={startCh}
                  onChange={(e) => setStartCh(e.target.value)}
                  className="drainer-input"
                />
              </div>
              <div>
                <label className="drainer-label block mb-1">End CH</label>
                <Input
                  type="number"
                  value={endCh}
                  onChange={(e) => setEndCh(e.target.value)}
                  className="drainer-input"
                />
              </div>
            </div>
            <div>
              <label className="drainer-label block mb-1">Direction</label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="drainer-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onwards">Onwards</SelectItem>
                  <SelectItem value="backwards">Backwards</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="drainer-label block mb-1">Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">Project Number</label>
              <Input
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                className="drainer-input"
              />
            </div>
            <div>
              <label className="drainer-label block mb-1">ITP Number</label>
              <Input
                value={itpNumber}
                onChange={(e) => setItpNumber(e.target.value)}
                className="drainer-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendQROpen} onOpenChange={setSendQROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send QR to</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email address"
              value={sendQREmail}
              onChange={(e) => setSendQREmail(e.target.value)}
              className="drainer-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendQROpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendQR}
              disabled={!sendQREmail.trim() || sendingQR}
            >
              {sendingQR ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reportModalOpen}
        onOpenChange={(open) => {
          setReportModalOpen(open);
          if (!open) setReportModalType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send report to</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(reportModalType === "itr-complete" || reportModalType === "itr-open") && reportModalPayload && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Max 9 records per ITR-PLA-001 page. This ITR has {reportModalPayload.recordCount ?? 0} records.
              </p>
            )}
            <Input
              type="email"
              placeholder="Email address"
              value={reportEmail}
              onChange={(e) => setReportEmail(e.target.value)}
              className="drainer-input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendReport}
              disabled={
                !reportEmail.trim() ||
                printingItrIndex !== null ||
                printingAudit
              }
            >
              {(printingItrIndex !== null || printingAudit)
                ? "Sending…"
                : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
