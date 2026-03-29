"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { AuthPanel } from "@/components/auth-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionRecords } from "@/components/admin/section-records";
import { RecordEditForm } from "@/components/admin/record-edit-form";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { PipeRecord } from "@/components/admin/record-edit-form";
import { useToast } from "@/components/toast";

export default function AdminRecordsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sectionId = params.sectionId as string;
  const chMinParam = searchParams.get("chMin");
  const chMaxParam = searchParams.get("chMax");
  const recordFromId = searchParams.get("recordFromId");
  const recordToId = searchParams.get("recordToId");

  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sections, setSections] = useState<{ id: string; name: string; start_ch?: number | null; end_ch?: number | null }[]>([]);
  const [records, setRecords] = useState<PipeRecord[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pipeSearch, setPipeSearch] = useState("");
  const [progressRefreshTrigger, setProgressRefreshTrigger] = useState(0);

  const chMin = chMinParam != null ? parseFloat(chMinParam) : null;
  const chMax = chMaxParam != null ? parseFloat(chMaxParam) : null;

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
      sections?: { id: string; name: string; start_ch?: number | null; end_ch?: number | null }[];
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

  const loadRecords = useCallback(async () => {
    if (!sectionId) return;
    const token = await getAccessToken();
    let url = `/api/drainer/records?sectionId=${sectionId}`;
    if (recordFromId && recordToId) {
      url += `&recordFromId=${encodeURIComponent(recordFromId)}&recordToId=${encodeURIComponent(recordToId)}&context=2`;
    }
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    const recs: PipeRecord[] = data.records ?? [];
    setRecords(recs);
  }, [sectionId, getAccessToken, recordFromId, recordToId]);

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
      if (json.isAdmin) loadSections();
    };
    check();
  }, [authEmail, getAccessToken, loadSections]);

  useEffect(() => {
    if (sectionId && isAdmin) {
      loadRecords();
    } else {
      setRecords([]);
    }
  }, [sectionId, isAdmin, loadRecords]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (!recordFromId || !recordToId) {
      if (chMin != null || chMax != null) {
        list = list.filter((r) => {
          const ch = Number(r.chainage);
          if (chMin != null && ch < chMin) return false;
          if (chMax != null && ch > chMax) return false;
          return true;
        });
      }
    }
    const q = pipeSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const pf = (r.pipe_fitting_id ?? "").toLowerCase();
      return pf.includes(q);
    });
  }, [records, chMin, chMax, recordFromId, recordToId, pipeSearch]);

  const selectedSection = sections.find((s) => s.id === sectionId);
  const sectionName = selectedSection?.name ?? sectionId ?? "Records";

  const handleEditRecord = (id: string) => {
    setEditId(id);
    setEditOpen(true);
  };

  const handleEditSaved = () => {
    loadRecords();
    setProgressRefreshTrigger((t) => t + 1);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditId(null);
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
          <h1 className="drainer-title text-xl">Records</h1>
          <AuthPanel onAuthChange={setAuthEmail} />
          <p className="text-sm text-[var(--muted-foreground)] mt-4">
            {!authEmail ? "Sign in to access." : "Access denied."}
          </p>
        </div>
      </div>
    );
  }

  if (!sectionId) {
    return (
      <div className="drainer-page">
        <div className="drainer-shell">
          <p className="text-sm text-[var(--muted-foreground)]">
            Select a section from Admin.
          </p>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="mt-2">
              Back to Admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="drainer-page">
      <div className="drainer-shell max-w-4xl">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="drainer-title text-xl">{sectionName} — Records</h1>
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                Back to Admin
              </Button>
            </Link>
          </div>
          <AuthPanel onAuthChange={setAuthEmail} />
        </div>

        <AdminNav />

        {(recordFromId && recordToId) && (
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            Context: 2 records before and 2 after the inconsistency pair ({filteredRecords.length} records)
          </p>
        )}
        {(chMin != null || chMax != null) && !recordFromId && (
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            Filtered: CH {chMin ?? "—"} to {chMax ?? "—"} ({filteredRecords.length} records)
          </p>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)] pointer-events-none" />
          <Input
            type="text"
            placeholder="Search Pipe #..."
            value={pipeSearch}
            onChange={(e) => setPipeSearch(e.target.value)}
            className="pl-9 max-w-xs"
          />
        </div>

        <SectionRecords
          sectionName={sectionName}
          sectionId={sectionId}
          records={filteredRecords}
          onEditRecord={handleEditRecord}
          getAccessToken={getAccessToken}
          emptyMessage={pipeSearch.trim() && filteredRecords.length === 0 ? "No records found" : undefined}
          progressRefreshTrigger={progressRefreshTrigger}
        />
      </div>

      <RecordEditForm
        recordId={editId}
        open={editOpen}
        onClose={handleEditClose}
        onSaved={handleEditSaved}
        getAccessToken={getAccessToken}
      />
    </div>
  );
}
