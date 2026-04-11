"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LodgeForm } from "@/components/lodge-form";

type Section = {
  id: string;
  name: string;
  joint_types?: string[] | null;
  guide_enabled?: boolean;
  guide_xml?: { sequence_number: number; item_id: string }[] | null;
};

function EnterContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [section, setSection] = useState<Section | null>(null);

  useEffect(() => {
    if (!token?.trim()) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/drainer/enter?token=${encodeURIComponent(token.trim())}`
      );
      const data = (await res.json()) as { section?: Section; error?: string };
      if (cancelled) return;
      if (!res.ok || !data.section) {
        setStatus("error");
        return;
      }
      setSection(data.section);
      setStatus("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
    );
  }

  if (status === "error" || !section) {
    return (
      <p className="text-sm text-[var(--foreground)]" role="alert">
        QR code not recognised. Please scan again or contact your supervisor.
      </p>
    );
  }

  return (
    <LodgeForm
      sections={[section]}
      sectionId={section.id}
      onSectionChange={() => {}}
      lockedSectionId={section.id}
      onSuccess={() => {}}
    />
  );
}

export default function EnterPage() {
  return (
    <div className="drainer-page">
      <div className="drainer-shell">
        <div className="drainer-header flex flex-col gap-2 mb-4">
          <h1 className="drainer-title text-xl">Pipe Laying Tracker</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Field entry — section is fixed for this link.
          </p>
        </div>
        <Suspense
          fallback={
            <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
          }
        >
          <EnterContent />
        </Suspense>
      </div>
    </div>
  );
}
