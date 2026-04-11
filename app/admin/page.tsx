"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { SectionProgressBar } from "@/components/admin/section-records";
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
import {
  normalizeGuideXmlFromJsonb,
  parseGuideXLSX,
  type GuideItem,
} from "@/lib/installation-guide-xml";

/** Stable row id for React keys when reordering by sequence (not persisted). */
type GuideTableRow = GuideItem & { _rowId: string };

function withStableRowIds(items: GuideItem[]): GuideTableRow[] {
  return items.map((item) => ({
    ...item,
    _rowId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${item.sequence_number}-${item.item_id}-${Math.random().toString(36).slice(2)}`,
  }));
}

function stripRowIds(rows: GuideTableRow[]): GuideItem[] {
  return rows.map(({ sequence_number, item_id }) => ({
    sequence_number,
    item_id,
  }));
}

type Section = {
  id: string;
  name: string;
  start_ch: number | null;
  end_ch: number | null;
  direction: string | null;
  project_id: string | null;
  projects: { name: string | null; number: string | null } | null;
  itp_number: string | null;
  joint_types: string[] | null;
  guide_enabled?: boolean;
  guide_xml?: GuideItem[] | null;
};

/** Which joint types are available on site for this section (Edit Section). */
const SECTION_JOINT_TYPES = [
  { value: "RRJ", label: "RRJ (Rubber Ring Joint)" },
  { value: "WR", label: "WR (Weld Restrained)" },
  { value: "Transition", label: "Transition" },
  { value: "WB", label: "WB (Weld Band)" },
] as const;

/** Pipe: digits-hyphen-digits, PP+digits-hyphen-digits, or just digits. Fitting: anything else. */
const PIPE_REGEX = /^((PP)?\d+-\d+|\d+)$/;

type RecordRow = {
  id: string;
  chainage: number;
  date_installed: string | null;
  pipe_fitting_id?: string | null;
};

/**
 * Pipes: 000536-000096, PP000010-000169, or just numbers. Fittings: rest (double scour, bend, valve, etc).
 * Empty not counted as fitting.
 */
function countPipesAndFittings(records: RecordRow[]): { pipes: number; fittings: number } {
  let pipes = 0;
  let fittings = 0;
  for (const r of records) {
    const pf = (r.pipe_fitting_id ?? "").trim();
    if (!pf) continue;
    if (PIPE_REGEX.test(pf)) pipes++;
    else fittings++;
  }
  return { pipes, fittings };
}

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
  const [sectionJointTypesAllowed, setSectionJointTypesAllowed] = useState<string[]>(
    []
  );
  const [guideEnabled, setGuideEnabled] = useState(false);
  const [guideItems, setGuideItems] = useState<GuideTableRow[]>([]);
  const [guideXlsxInputKey, setGuideXlsxInputKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [printingItrIndex, setPrintingItrIndex] = useState<number | null>(null);
  const [printingAudit, setPrintingAudit] = useState(false);
  const [printingAllItr, setPrintingAllItr] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<
    "itr-complete" | "itr-open" | "itr-all" | "audit" | null
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
  const [progressRefreshTrigger, setProgressRefreshTrigger] = useState(0);

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
      sections?: Section[];
      error?: string;
      sectionsMeta?: { projectEmbedOk?: boolean };
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
    setSectionId((prev) => {
      const next = data.sections!.find((s: Section) => s.id === prev)?.id;
      return next ?? (data.sections![0]?.id ?? "");
    });
    if (data.sectionsMeta?.projectEmbedOk === false) {
      console.warn(
        "[admin] drainer_sections: project embed unavailable; listing sections without joined project name/number."
      );
    }
  }, [getAccessToken, pushToast]);

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

  const { pipes: pipesInstalled, fittings: fittingsInstalled } = useMemo(
    () => countPipesAndFittings(records),
    [records]
  );

  const reportsPending = progress.currentOpenCount > 0 ? 1 : 0;

  const handleGuideXLSXUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseGuideXLSX(buffer);
      if (parsed.length === 0) {
        pushToast({
          type: "error",
          title: "No rows",
          message:
            "Use a header row with columns sequence_number and item_id.",
        });
        return;
      }
      setGuideItems(withStableRowIds(parsed));
      pushToast({
        type: "success",
        title: "Excel loaded",
        message: `${parsed.length} item(s).`,
      });
    } catch (err) {
      pushToast({
        type: "error",
        title: "Invalid spreadsheet",
        message: err instanceof Error ? err.message : "Could not read file",
      });
    }
  };

  const clearGuideSheet = () => {
    setGuideItems([]);
    setGuideXlsxInputKey((k) => k + 1);
  };

  const openCreate = () => {
    setModalMode("create");
    setEditId(null);
    setName("");
    setStartCh("");
    setEndCh("");
    setDirection("onwards");
    setSectionJointTypesAllowed([]);
    setGuideEnabled(false);
    setGuideItems([]);
    setGuideXlsxInputKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEdit = (s: Section) => {
    setModalMode("edit");
    setEditId(s.id);
    setName(s.name);
    setStartCh(s.start_ch != null ? String(s.start_ch) : "");
    setEndCh(s.end_ch != null ? String(s.end_ch) : "");
    setDirection(s.direction ?? "onwards");
    const allowed = Array.isArray(s.joint_types) ? s.joint_types : [];
    setSectionJointTypesAllowed(
      SECTION_JOINT_TYPES.map((j) => j.value).filter((v) => allowed.includes(v))
    );
    setGuideEnabled(!!s.guide_enabled);
    setGuideItems(
      withStableRowIds(normalizeGuideXmlFromJsonb(s.guide_xml) ?? [])
    );
    setGuideXlsxInputKey((k) => k + 1);
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
      const existingSection =
        modalMode === "edit" && editId
          ? sections.find((s) => s.id === editId)
          : undefined;
      const existingProjectId = existingSection?.project_id ?? null;
      const existingItpNumber = existingSection?.itp_number ?? null;
      const payload = {
        name,
        start_ch: startCh ? Number(startCh) : null,
        end_ch: endCh ? Number(endCh) : null,
        direction: direction || null,
        project_id: existingProjectId,
        itp_number: existingItpNumber,
        ...(modalMode === "edit"
          ? {
              joint_types:
                sectionJointTypesAllowed.length > 0
                  ? sectionJointTypesAllowed
                  : null,
              guide_enabled: guideEnabled,
              guide_xml:
                guideEnabled && guideItems.length > 0
                  ? stripRowIds(guideItems)
                  : null,
            }
          : {}),
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
    type: "itr-complete" | "itr-open" | "itr-all" | "audit",
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
    } else if (reportModalType === "itr-all") {
      setPrintingAllItr(true);
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
      } else if (reportModalType === "itr-all") {
        const res = await fetch("/api/drainer/report/itr-pla-001/email-all", {
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
          title: "All ITRs sent",
          message: `All ITR reports sent to ${email}`,
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
      setPrintingAllItr(false);
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
                Back to User
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
                  Create section
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
                      disabled={!sectionId || printingAudit || printingAllItr}
                    >
                      {printingAudit ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin shrink-0 mr-1" />
                          Sending…
                        </>
                      ) : (
                        "Send Audit"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] px-4 text-sm border-0 drainer-button-accent"
                      onClick={() => openReportModal("itr-all", {})}
                      disabled={!sectionId || itrBlocks.length === 0 || printingAudit || printingAllItr}
                    >
                      {printingAllItr ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin shrink-0 mr-1" />
                          Sending…
                        </>
                      ) : (
                        "Send All ITR"
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
                    setProgressRefreshTrigger((t) => t + 1);
                  }}
                  disabled={recordsRefreshing}
                  title="Refresh"
                >
                  <RefreshCw className={`size-4 ${recordsRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-semibold text-sm text-[var(--ink)]">{selectedSection.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="drainer-badge-ready">
                      <span className="drainer-badge-ready-dot" aria-hidden />
                      Ready {progress.completeITRs}
                    </span>
                    <span className="drainer-badge-open">
                      <span className="drainer-badge-open-dot" aria-hidden />
                      Open {reportsPending}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="text-[var(--muted-foreground)]">Records: {records.length}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--muted-foreground)]">Pipes installed</span>
                    <span className="font-semibold text-[var(--ink)]">{pipesInstalled}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--muted-foreground)]">Fittings installed</span>
                    <span className="font-semibold text-[var(--ink)]">{fittingsInstalled}</span>
                  </div>
                </div>
              </div>
              <SectionProgressBar sectionId={sectionId} getAccessToken={getAccessToken} refreshTrigger={progressRefreshTrigger} />
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
                            className={
                              block.status === "READY"
                                ? "drainer-badge-ready"
                                : "drainer-badge-open"
                            }
                          >
                            {block.status === "READY" ? (
                              <>
                                <span className="drainer-badge-ready-dot" aria-hidden />
                                Complete
                              </>
                            ) : (
                              <>
                                <span className="drainer-badge-open-dot" aria-hidden />
                                {block.recordCount} / 9 records
                              </>
                            )}
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
                          disabled={printingItrIndex !== null || printingAllItr}
                        >
                          {printingItrIndex === block.index ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              Sending…
                            </>
                          ) : (
                            "Send ITR"
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
                          disabled={printingItrIndex !== null || printingAllItr}
                        >
                          {printingItrIndex === block.index ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              Sending…
                            </>
                          ) : (
                            "Send ITR"
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
              {modalMode === "create" ? "Create section" : "Edit Section"}
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
            {modalMode === "edit" && (
              <div className="space-y-2">
                <span className="drainer-label block mb-1">
                  Joint types available on site
                </span>
                <p className="text-[11px] text-[var(--muted-foreground)] mb-2">
                  Leave all unchecked to allow every type. Tick only the types
                  users may lodge in this section.
                </p>
                <div className="flex flex-col gap-2">
                  {SECTION_JOINT_TYPES.map((j) => (
                    <label
                      key={j.value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-[var(--card-border)]"
                        checked={sectionJointTypesAllowed.includes(j.value)}
                        onChange={() => {
                          setSectionJointTypesAllowed((prev) =>
                            prev.includes(j.value)
                              ? prev.filter((x) => x !== j.value)
                              : [...prev, j.value]
                          );
                        }}
                      />
                      {j.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {modalMode === "edit" && (
              <div className="space-y-3 pt-3 border-t border-[var(--card-border)]">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={guideEnabled}
                    onChange={(e) => {
                      const c = e.target.checked;
                      setGuideEnabled(c);
                      if (!c) {
                        setGuideItems([]);
                        setGuideXlsxInputKey((k) => k + 1);
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Enable Installation Guide for this section
                </label>
                {guideEnabled && (
                  <div className="space-y-2 pl-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        key={guideXlsxInputKey}
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleGuideXLSXUpload}
                        className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {guideItems.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={clearGuideSheet}
                        >
                          Clear sheet
                        </Button>
                      )}
                    </div>
                    {guideItems.length > 0 && (
                      <div className="mt-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">
                                Sequence order
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                                Item ID
                              </th>
                              <th className="px-3 py-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {guideItems.map((item) => (
                              <tr
                                key={item._rowId}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-3 py-1.5">
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={item.sequence_number}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const n = parseInt(raw, 10);
                                      setGuideItems((prev) =>
                                        prev.map((row) =>
                                          row._rowId === item._rowId
                                            ? {
                                                ...row,
                                                sequence_number:
                                                  raw === "" || !Number.isFinite(n)
                                                    ? row.sequence_number
                                                    : n,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                    onBlur={() => {
                                      setGuideItems((prev) =>
                                        [...prev].sort(
                                          (a, b) =>
                                            a.sequence_number - b.sequence_number
                                        )
                                      );
                                    }}
                                    className="w-full min-w-[4rem] text-sm bg-transparent border-0 focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-gray-700"
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <input
                                    type="text"
                                    value={item.item_id}
                                    onChange={(e) => {
                                      setGuideItems((prev) =>
                                        prev.map((row) =>
                                          row._rowId === item._rowId
                                            ? {
                                                ...row,
                                                item_id: e.target.value,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                    className="w-full text-sm bg-transparent border-0 focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5"
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGuideItems((prev) =>
                                        prev.filter(
                                          (row) => row._rowId !== item._rowId
                                        )
                                      )
                                    }
                                    className="text-red-400 hover:text-red-600 text-xs font-bold"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                          {guideItems.length} items · Edit sequence order and
                          item ID inline · ✕ to remove a row
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="bg-[#EEE4DA] border-[var(--card-border)] hover:bg-[#E8D2BF]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
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
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
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
                printingAudit ||
                printingAllItr
              }
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
              {(printingItrIndex !== null || printingAudit || printingAllItr)
                ? "Sending…"
                : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
