export type WeldWrapStatusFilterKey =
  | "weld_pending"
  | "weld_completed"
  | "wrap_pending"
  | "wrap_completed"
  | "all";

export type WeldWrapFilterableRecord = {
  joint_type: string | null;
  welded_at: string | null;
  wrapped_at: string | null;
};

export function requiresWeldWrap(jointType: string | null | undefined): boolean {
  return jointType !== "RRJ";
}

export const WELD_WRAP_STATUS_MATCHERS: Record<
  Exclude<WeldWrapStatusFilterKey, "all">,
  (record: WeldWrapFilterableRecord) => boolean
> = {
  weld_completed: (record) => record.welded_at != null,
  weld_pending: (record) =>
    requiresWeldWrap(record.joint_type) && record.welded_at == null,
  wrap_completed: (record) => record.wrapped_at != null,
  wrap_pending: (record) =>
    requiresWeldWrap(record.joint_type) && record.wrapped_at == null,
};

const FILTER_LABELS: Record<Exclude<WeldWrapStatusFilterKey, "all">, string> = {
  weld_pending: "Weld pending",
  weld_completed: "Weld completed",
  wrap_pending: "Wrap pending",
  wrap_completed: "Wrap completed",
};

export function normalizeStatusFilters(
  input: WeldWrapStatusFilterKey[] | undefined | null
): Exclude<WeldWrapStatusFilterKey, "all">[] {
  if (!input?.length || input.includes("all")) return [];
  return input.filter(
    (key): key is Exclude<WeldWrapStatusFilterKey, "all"> => key !== "all"
  );
}

export function filterRecordsByStatus<T extends WeldWrapFilterableRecord>(
  records: T[],
  selected: WeldWrapStatusFilterKey[] | undefined | null
): T[] {
  const active = normalizeStatusFilters(selected);
  if (active.length === 0) return records;
  return records.filter((record) =>
    active.some((key) => WELD_WRAP_STATUS_MATCHERS[key](record))
  );
}

export function formatStatusFilterLabel(
  selected: WeldWrapStatusFilterKey[] | undefined | null
): string {
  const active = normalizeStatusFilters(selected);
  if (active.length === 0) return "All records";
  return active.map((key) => FILTER_LABELS[key]).join(", ");
}

export const WELD_WRAP_STATUS_FILTER_OPTIONS: {
  key: WeldWrapStatusFilterKey;
  label: string;
}[] = [
  { key: "weld_pending", label: "Weld pending" },
  { key: "weld_completed", label: "Weld completed" },
  { key: "wrap_pending", label: "Wrap pending" },
  { key: "wrap_completed", label: "Wrap completed" },
  { key: "all", label: "All" },
];
