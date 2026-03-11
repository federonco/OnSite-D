/**
 * Maps raw record data to display values for ITR-PLA-001 report.
 */

export type RecordRow = {
  date_installed: string | null;
  chainage: number;
  pipe_fitting_id: string | null;
  joint_type: string | null;
  witness_mark: boolean | null;
  internal_seal: boolean | null;
  deflection_v_sign: string | null;
  deflection_v_mm: number | null;
  deflection_h_side: string | null;
  deflection_h_mm: number | null;
  cp_lugs: boolean | null;
  ovality_check: boolean | null;
  joint_air_test: boolean | null;
  cement_liner: boolean | null;
  spark_testing: boolean | null;
  inspector_name: string | null;
};

export function formatDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function formatChainage(n: number): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAlignment(r: RecordRow): string {
  const vSign = r.deflection_v_sign ?? "+";
  const vMm = r.deflection_v_mm ?? 0;
  const hSide = r.deflection_h_side ?? "L";
  const hMm = r.deflection_h_mm ?? 0;
  return `V: ${vSign}${vMm}mm / H: ${hSide}${hMm}mm`;
}

function yn(val: boolean | null | undefined): string {
  if (val == null) return "";
  return val ? "Y" : "";
}

export function passOrEmpty(val: boolean | null | undefined): string {
  if (val == null) return "";
  return val ? "PASS" : "";
}

export function cpLugsVal(r: RecordRow): string {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  if (jt !== "RRJ") return "N/A";
  return yn(r.cp_lugs);
}

export function jointAirTestVal(r: RecordRow): string {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  if (jt === "TRANSITION") return "N/A";
  if (jt === "RRJ" || jt === "WR") return yn(r.joint_air_test);
  return "N/A";
}

export function cementLinerVal(r: RecordRow): string {
  if (r.cement_liner == null) return "";
  return r.cement_liner ? "OK" : "Patch";
}

export function mapRecordToCells(r: RecordRow): string[] {
  return [
    formatDate(r.date_installed),
    formatChainage(r.chainage),
    r.pipe_fitting_id ?? "",
    r.joint_type ?? "",
    yn(r.witness_mark),
    yn(r.internal_seal),
    formatAlignment(r),
    cpLugsVal(r),
    passOrEmpty(r.ovality_check),
    jointAirTestVal(r),
    cementLinerVal(r),
    passOrEmpty(r.spark_testing),
    r.inspector_name ?? "",
    "", // signature
  ];
}
