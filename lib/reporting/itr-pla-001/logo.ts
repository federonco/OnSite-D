/**
 * Logo resolution for ITR-PLA-001 PDF.
 * Returns base64 data URL for serverless-safe embedding (no external fetch).
 */

import path from "path";
import fs from "fs";

let _logoDataUrl: string | null = null;

const LOGO_FILENAME = "Alkimos Logo.png";
const CANDIDATE_PATHS = [
  () => path.join(process.cwd(), "public", LOGO_FILENAME),
  () => path.resolve(process.cwd(), "public", LOGO_FILENAME),
  () => path.join(__dirname, "..", "..", "..", "public", LOGO_FILENAME),
];

export function getLogoSrc(): string | null {
  if (_logoDataUrl) return _logoDataUrl;
  for (const fn of CANDIDATE_PATHS) {
    try {
      const p = fn();
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        _logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
        return _logoDataUrl;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}
