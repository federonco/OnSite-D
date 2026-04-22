"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LodgeForm } from "@/components/lodge-form";
import { LastPipesView } from "@/components/last-pipes-view";
import { Button } from "@/components/ui/button";

type Section = {
  id: string;
  name: string;
  joint_types?: string[] | null;
  guide_enabled?: boolean;
  guide_xml?: { sequence_number: number; item_id: string }[] | null;
  subsection_id?: string;
};

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [lastPipesRefresh, setLastPipesRefresh] = useState(0);

  const urlSection = searchParams.get("section_id") ?? searchParams.get("section");
  const urlSubsectionId = searchParams.get("subsection_id");
  const urlCh = searchParams.get("ch");

  const loadSections = useCallback(async () => {
    const params = new URLSearchParams();
    if (urlSubsectionId) params.set("subsection_id", urlSubsectionId);
    const qs = params.toString();
    const res = await fetch(`/api/drainer/sections${qs ? `?${qs}` : ""}`);
    const data = (await res.json()) as { sections?: Section[]; error?: string };
    if (!res.ok) {
      setSectionsError(data.error ?? res.statusText);
      return;
    }
    setSectionsError(null);
    if (!Array.isArray(data.sections)) {
      setSectionsError("Invalid response from server.");
      return;
    }
    setSections(data.sections);
    setSectionId((prev) => {
      const fromSubsection =
        urlSubsectionId &&
        data.sections!.find((s: Section) => s.subsection_id === urlSubsectionId)?.id;
      const fromUrl =
        urlSection && data.sections!.find((s: Section) => s.id === urlSection)?.id;
      const next =
        fromUrl ??
        fromSubsection ??
        data.sections!.find((s: Section) => s.id === prev)?.id;
      return next ?? (data.sections![0]?.id ?? "");
    });
  }, [urlSection, urlSubsectionId]);

  useEffect(() => {
    loadSections().finally(() => setLoading(false));
  }, [loadSections, urlSection, urlSubsectionId]);

  const setSectionAndUrl = useCallback(
    (id: string) => {
      setSectionId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("section_id", id);
      params.delete("section");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

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
            <h1 className="drainer-title text-xl">Pipe Laying Tracker</h1>
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
        ) : sectionsError ? (
          <p className="text-sm text-destructive">
            Could not load sections: {sectionsError}
          </p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No sections yet. Create one in Admin.
          </p>
        ) : (
          <>
            <LodgeForm
              sections={sections}
              sectionId={sectionId}
              subsectionId={urlSubsectionId ?? undefined}
              onSectionChange={setSectionAndUrl}
              initialCh={urlCh}
              onSuccess={() => setLastPipesRefresh((k) => k + 1)}
            />
            <LastPipesView sectionId={sectionId} refreshTrigger={lastPipesRefresh} />
          </>
        )}
      </div>
    </div>
  );
}
