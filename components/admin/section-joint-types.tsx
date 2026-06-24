"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

const JOINT_OPTIONS = ["RRJ", "WR", "WB", "Transition"] as const;

export function SectionJointTypesEditor({
  sectionId,
  getAccessToken,
}: {
  sectionId: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const { pushToast } = useToast();
  const [jointTypes, setJointTypes] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/drainer/sections/${sectionId}/joint-types`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { joint_types?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      const next = Array.isArray(data.joint_types) ? data.joint_types : [];
      setJointTypes(next);
      setSaved(next);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Could not load joint types",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [sectionId, getAccessToken, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in required");
      const res = await fetch(`/api/drainer/sections/${sectionId}/joint-types`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ joint_types: jointTypes }),
      });
      const data = (await res.json()) as { joint_types?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const next = data.joint_types ?? jointTypes;
      setJointTypes(next);
      setSaved(next);
      pushToast({ type: "success", title: "Joint types saved" });
    } catch (err) {
      pushToast({
        type: "error",
        title: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(jointTypes) !== JSON.stringify(saved);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm space-y-3">
      <p className="text-sm font-semibold text-[var(--ink)]">Section joint types</p>
      {loading ? (
        <p className="text-xs text-[var(--muted-foreground)]">Loading…</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {JOINT_OPTIONS.map((jt) => (
            <label key={jt} className="inline-flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="size-3 accent-[#B8682A]"
                checked={jointTypes.includes(jt)}
                onChange={(e) =>
                  setJointTypes((prev) =>
                    e.target.checked ? [...prev, jt] : prev.filter((t) => t !== jt)
                  )
                }
              />
              {jt}
            </label>
          ))}
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="min-h-[36px]"
        disabled={saving || loading || !dirty}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save joint types"}
      </Button>
    </div>
  );
}
