"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { AdminNav } from "@/components/admin-nav";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

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
      if (json.isAdmin) loadSections();
    };
    check();
  }, [authEmail, getAccessToken, loadSections]);

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
              <Link href="/admin">
                <Button variant="outline" size="sm" className="h-9 text-xs">
                  Drainer Admin Center
                </Button>
              </Link>
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
            Las secciones se gestionan desde el Dashboard admin.
          </p>
          <p className="text-[var(--muted-foreground)]">
            Abrir Dashboard admin → apa-dashboard.readx.com.au/admin · OnSite-D
            gestiona únicamente subsecciones.
          </p>
          <div>
            <a
              href={DASHBOARD_HOME}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[#B8682A] hover:underline"
            >
              Abrir Dashboard admin
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
      </div>
    </div>
  );
}
