"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { useToast } from "@/components/toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type MissedCheckpoint = {
  id: string;
  name: string;
  ch: number;
  detected_at_ch: number;
};

type RecordInconsistency = {
  record_a_ch: number;
  record_b_ch: number;
  difference: number;
  type: "gap" | "overlap";
};

export default function NotificationsPage() {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [missed, setMissed] = useState<MissedCheckpoint[]>([]);
  const [inconsistencies, setInconsistencies] = useState<RecordInconsistency[]>([]);
  const [inconsistenciesLoading, setInconsistenciesLoading] = useState(true);

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
      const res = await fetch("/api/drainer/inconsistencies", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.inconsistencies) setInconsistencies(data.inconsistencies);
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
          <h1 className="drainer-title text-xl">Notifications</h1>
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
      <div className="drainer-shell max-w-2xl">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="drainer-title text-xl">Notifications</h1>
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
            <CardTitle className="text-sm">⚠️ Record Inconsistencies</CardTitle>
            <Button variant="outline" size="sm" onClick={loadInconsistencies} disabled={inconsistenciesLoading}>
              {inconsistenciesLoading ? "Loading…" : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent>
            {inconsistenciesLoading ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4">Loading…</p>
            ) : inconsistencies.length === 0 ? (
              <p className="text-sm text-green-600 py-4">No inconsistencies found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2">CH From</th>
                      <th className="text-left py-2 px-2">CH To</th>
                      <th className="text-left py-2 px-2">Difference (m)</th>
                      <th className="text-left py-2 px-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inconsistencies.map((inc, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)]/50">
                        <td className="py-2 px-2">{inc.record_a_ch.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2">{inc.record_b_ch.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2">{inc.difference.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              inc.type === "gap" ? "bg-red-500 text-white" : "bg-orange-500 text-white"
                            }`}
                          >
                            {inc.type === "gap" ? "Gap — missing pipe?" : "Overlap — duplicate entry?"}
                          </span>
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
              Active checkpoints that did not trigger an alert because the current CH already passed the point (record was added without going through proximity verification).
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
                        <td className="py-2 px-2">{m.ch.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2">{m.detected_at_ch.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
