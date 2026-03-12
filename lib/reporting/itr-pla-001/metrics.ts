/**
 * Lightweight size/time metrics for PDF generation.
 * No heavy deps; approximate byte sizes for logging.
 */

/** Approx bytes of a string (UTF-8) */
export function bytesOfString(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Approx bytes of a Buffer */
export function bytesOfBuffer(b: Buffer | Uint8Array): number {
  return b.length;
}

/** Approx bytes of a plain object (JSON serialization) */
export function bytesOfObject(obj: unknown): number {
  try {
    return bytesOfString(JSON.stringify(obj));
  } catch {
    return 0;
  }
}

/** Approx KB for display */
export function toKb(bytes: number): number {
  return Math.round(bytes / 1024);
}

/** Time in ms since start */
export function elapsed(start: number): number {
  return Date.now() - start;
}
