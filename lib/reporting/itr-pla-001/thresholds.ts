/**
 * ITR-PLA-001 PDF thresholds and limits.
 * All configurable via env; defaults tuned for Vercel Hobby 1024 MB.
 */

function envNum(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v == null || v === "") return defaultVal;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultVal : Math.max(0, n);
}

function envBool(key: string, defaultVal: boolean): boolean {
  const v = process.env[key];
  if (v == null || v === "") return defaultVal;
  return v === "true" || v === "1";
}

/** Timeout for Puppeteer setContent + pdf (ms) */
export function getTimeoutMs(): number {
  return envNum("ITR_PDF_TIMEOUT_MS", 15000);
}

/** Max input payload size (KB). Warn or force React-PDF when exceeded. */
export function getMaxInputKb(): number {
  return envNum("ITR_PDF_MAX_INPUT_KB", 256);
}

/** Max prepared data size (KB) */
export function getMaxPreparedKb(): number {
  return envNum("ITR_PDF_MAX_PREPARED_KB", 128);
}

/** Max HTML size (KB). When exceeded in auto, force React-PDF. */
export function getMaxHtmlKb(): number {
  return envNum("ITR_PDF_MAX_HTML_KB", 64);
}

/** Max images count. When exceeded in auto, force React-PDF. */
export function getMaxImages(): number {
  return envNum("ITR_PDF_MAX_IMAGES", 0);
}

/** Max render time (ms). Log warning when exceeded. */
export function getMaxRenderMs(): number {
  return envNum("ITR_PDF_MAX_RENDER_MS", 30000);
}

/** If true, only warn; don't force React-PDF on threshold exceed. */
export function getWarnOnly(): boolean {
  return envBool("ITR_PDF_WARN_ONLY", true);
}

/** If true, emit all metrics and heuristic reasons. */
export function getDebug(): boolean {
  return envBool("ITR_PDF_DEBUG", false);
}
