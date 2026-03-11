/**
 * Audit summary calculations for Section Audit Report.
 * Computes pass/fail counts and breakdown by check type.
 */

export type AuditRecord = {
  joint_type: string | null;
  witness_mark: boolean | null;
  internal_seal: boolean | null;
  cp_lugs: boolean | null;
  ovality_check: boolean | null;
  joint_air_test: boolean | null;
  cement_liner: boolean | null;
  spark_testing: boolean | null;
};

export type AuditSummary = {
  total: number;
  allPassed: number;
  withIssues: number;
  passRatePct: number;
  issueRatePct: number;
  failures: {
    cp: number;
    ovality: number;
    air: number;
    cement: number;
    spark: number;
  };
};

function isRRJ(r: AuditRecord): boolean {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  return jt === "RRJ";
}

function isRRJOrWR(r: AuditRecord): boolean {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  return jt === "RRJ" || jt === "WR";
}

/** Check if a record passes all applicable checks */
function recordPasses(r: AuditRecord): boolean {
  if (r.witness_mark !== true) return false;
  if (r.internal_seal !== true) return false;
  if (r.ovality_check !== true) return false;
  if (r.cement_liner !== true) return false;
  if (r.spark_testing !== true) return false;
  if (isRRJ(r) && r.cp_lugs !== true) return false;
  if (isRRJOrWR(r) && r.joint_air_test !== true) return false;
  return true;
}

/** Count records with failures in each check type */
function countFailures(records: AuditRecord[]): AuditSummary["failures"] {
  const failures = { cp: 0, ovality: 0, air: 0, cement: 0, spark: 0 };
  for (const r of records) {
    if (isRRJ(r) && r.cp_lugs === false) failures.cp++;
    if (r.ovality_check === false) failures.ovality++;
    if (isRRJOrWR(r) && r.joint_air_test === false) failures.air++;
    if (r.cement_liner === false) failures.cement++;
    if (r.spark_testing === false) failures.spark++;
  }
  return failures;
}

export function computeAuditSummary(records: AuditRecord[]): AuditSummary {
  const total = records.length;
  const allPassed = records.filter(recordPasses).length;
  const withIssues = total - allPassed;
  const passRatePct = total > 0 ? Math.round((allPassed / total) * 100) : 0;
  const issueRatePct = total > 0 ? Math.round((withIssues / total) * 100) : 0;
  const failures = countFailures(records);

  return {
    total,
    allPassed,
    withIssues,
    passRatePct,
    issueRatePct,
    failures,
  };
}
