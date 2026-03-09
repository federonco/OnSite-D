"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LodgeForm } from "@/components/lodge-form";
import { Button } from "@/components/ui/button";

type Section = {
  id: string;
  name: string;
};

export default function Home() {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSections = useCallback(async () => {
    const res = await fetch("/api/drainer/sections");
    const data = await res.json();
    if (data.sections) {
      setSections(data.sections);
      setSectionId((prev) => {
        const next = data.sections.find((s: Section) => s.id === prev)?.id;
        return next ?? (data.sections[0]?.id ?? "");
      });
    }
  }, []);

  useEffect(() => {
    loadSections().finally(() => setLoading(false));
  }, [loadSections]);

  useEffect(() => {
    const onFocus = () => loadSections();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSections]);

  return (
    <div className="drainer-page">
      <div className="drainer-shell">
        <div className="drainer-header flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="drainer-title text-xl">Pipe Records</h1>
            <Link href="/admin">
              <Button
                variant="ghost"
                className="shrink-0 h-8 min-h-8 border-0 px-3 text-xs font-semibold text-[var(--text-secondary)]"
              >
                ⚙ Admin
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No sections yet. Create one in Admin.
          </p>
        ) : (
          <LodgeForm
            sections={sections}
            sectionId={sectionId}
            onSectionChange={setSectionId}
          />
        )}
      </div>
    </div>
  );
}
