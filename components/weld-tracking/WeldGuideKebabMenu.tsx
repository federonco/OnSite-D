"use client";

import { useCallback, useRef, useState } from "react";
import { MoreVertical, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { GuideItem } from "@/lib/installation-guide-xml";
import {
  downloadGuideCsvTemplate,
  normalizeGuideItemsForSave,
  parseGuideCsv,
} from "@/lib/guide-csv";

type EditableGuideRow = { key: string; sequence_number: number; item_id: string };

function rowsFromGuide(items: GuideItem[]): EditableGuideRow[] {
  return items.map((row, index) => ({
    key: `row-${index}-${row.item_id}`,
    sequence_number: row.sequence_number,
    item_id: row.item_id,
  }));
}

function newRowKey() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function WeldGuideKebabMenu({
  sectionId,
  sectionName,
  isAdmin,
  getAccessToken,
  onGuideSaved,
}: {
  sectionId: string | null;
  sectionName?: string | null;
  isAdmin: boolean;
  getAccessToken: () => Promise<string | null>;
  onGuideSaved: () => void;
}) {
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<EditableGuideRow[]>([]);
  const [previewRows, setPreviewRows] = useState<GuideItem[]>([]);

  const loadGuide = useCallback(async () => {
    if (!sectionId) return [];
    setLoadingGuide(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/drainer/sections/${sectionId}/guide`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json().catch(() => ({}))) as {
        guide_xml?: GuideItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load guide");
      return Array.isArray(data.guide_xml) ? data.guide_xml : [];
    } finally {
      setLoadingGuide(false);
    }
  }, [sectionId, getAccessToken]);

  const openEditor = useCallback(async () => {
    if (!sectionId) return;
    try {
      const guide = await loadGuide();
      setRows(
        guide.length > 0
          ? rowsFromGuide(guide)
          : [{ key: newRowKey(), sequence_number: 1, item_id: "" }]
      );
      setEditorOpen(true);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Could not load guide",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [sectionId, loadGuide, pushToast]);

  const saveGuide = useCallback(
    async (items: GuideItem[]) => {
      if (!sectionId) return;
      setSaving(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Sign in required");
        const normalized = normalizeGuideItemsForSave(items);
        const res = await fetch(`/api/drainer/sections/${sectionId}/guide`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ guide_xml: normalized }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        pushToast({ type: "success", title: "Installation guide saved" });
        setEditorOpen(false);
        setPreviewOpen(false);
        onGuideSaved();
      } catch (err) {
        pushToast({
          type: "error",
          title: "Save failed",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setSaving(false);
      }
    },
    [sectionId, getAccessToken, onGuideSaved, pushToast]
  );

  const handleEditorSave = () => {
    const items = rows.map((row) => ({
      sequence_number: Number(row.sequence_number) || 0,
      item_id: row.item_id,
    }));
    void saveGuide(items);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseGuideCsv(text);
      if (parsed.length === 0) {
        pushToast({
          type: "error",
          title: "Import failed",
          message: "No valid rows found in CSV.",
        });
        return;
      }
      setPreviewRows(parsed);
      setPreviewOpen(true);
    } catch (err) {
      pushToast({
        type: "error",
        title: "Import failed",
        message: err instanceof Error ? err.message : "Could not parse CSV",
      });
    }
  };

  if (!isAdmin) return null;

  const disabled = !sectionId || sectionId === "all";

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 min-h-10 min-w-[40px] shrink-0 px-2"
            disabled={disabled}
            aria-label="Guide options"
            title="Guide options"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void openEditor()} disabled={disabled}>
            Editar guía
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Importar CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={downloadGuideCsvTemplate}>
            Descargar plantilla CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Editar guía{sectionName ? ` — ${sectionName}` : ""}
            </DialogTitle>
          </DialogHeader>
          {loadingGuide ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--muted-foreground)]">
                    <th className="w-16 pb-2 pr-2">Seq</th>
                    <th className="pb-2 pr-2">Pipe ID</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.key} className="border-t border-[var(--border)]">
                      <td className="py-1.5 pr-2 align-top">
                        <Input
                          type="number"
                          className="drainer-input h-9"
                          value={row.sequence_number}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      sequence_number: Number(e.target.value) || 0,
                                    }
                                  : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-2 align-top">
                        <Input
                          className="drainer-input h-9"
                          value={row.item_id}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === index ? { ...r, item_id: e.target.value } : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className="py-1.5 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() =>
                            setRows((prev) => prev.filter((_, i) => i !== index))
                          }
                          aria-label="Delete row"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    {
                      key: newRowKey(),
                      sequence_number: prev.length + 1,
                      item_id: "",
                    },
                  ])
                }
              >
                <Plus className="size-4 mr-1" />
                Agregar fila
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditorSave}
              disabled={saving || loadingGuide}
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
              {saving ? "Guardando…" : "Guardar guía"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview importación CSV</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">
            Esto reemplazará la guía completa ({previewRows.length} ítems).
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-alt)] sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Seq</th>
                  <th className="px-3 py-2 text-left">Pipe ID</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={`${row.sequence_number}-${row.item_id}`} className="border-t">
                    <td className="px-3 py-1.5">{row.sequence_number}</td>
                    <td className="px-3 py-1.5 font-mono">{row.item_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveGuide(previewRows)}
              disabled={saving}
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
              {saving ? "Importando…" : "Confirmar reemplazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
