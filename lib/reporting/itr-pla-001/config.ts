/**
 * ITR-PLA-001 layout configuration.
 * Fixed print layout - do not use for responsive UI.
 *
 * Business rule: Max 9 rows per ITR-PLA-001 page. The single-page PDF layout
 * fits exactly 9 data rows + notes. More than 9 rows will overflow and is unsupported.
 */
export const DOC_NO = "9823-PW-QAT-ITC-0009";
export const EFFECTIVE_DATE = "08/07/2025";
export const REVISION_NO = "1";
/** Max rows per ITR-PLA-001 page (enforced in generator and API). */
export const ITR_PAGE_SIZE = 9;
export const ITR_MAX_ROWS = 9;

export const COLORS = {
  BLUE: "#1155CC",
  GREY: "#D9D9D9",
  LIGHT_GREY: "#F5F5F5",
  WHITE: "#FFFFFF",
  BLACK: "#000000",
} as const;

<<<<<<< HEAD
/** Column widths in pt (matches target template). Date Installed reduced, Pipe No Stamp widened for single-line IDs. */
export const COL_WIDTHS_PT = [
  48, 55.5, 63, 55.5, 55.5, 39, 87.4, 48.9, 37.9, 43.4, 50.5, 55.5, 46.2, 55.5,
=======
/** Column widths in pt. 14 columns total. APA Signoff: NAME + SIGNATURE only, no extra. */
export const COL_WIDTHS_PT = [
  48, 52, 62, 50, 38, 40, 88, 46, 36, 42, 48, 48, 50, 50,
>>>>>>> origin/main
] as const;

/** Category row: [label, colspan] per JSON spec (7+3+2+2) */
export const CATEGORIES = [
  { label: "Pipe/ Fitting Details", colspan: 7 },
  { label: "PIPE SPECIFICS", colspan: 3 },
  { label: "FINAL CHECK", colspan: 2 },
  { label: "APA Signoff", colspan: 2 },
] as const;

/** Exact labels from Excel/JSON. 14 columns, table ends at SIGNATURE. */
export const COLUMN_HEADERS = [
  "Date Installed",
  "Pipe Chainage",
  "Pipe No Stamp or Fitting ID",
  "Joint Type\n (WR, RRJ,\nWB, or CWB)",
  "Pipe Installed to Wittness Mark\n(Y/N)",
  "Internal Rubber Seal Check (Y/N)",
  "Alignment & Deflection Check\nAlignment:\nHor ±100mm/ Vert ±50mm\nJoint Deflection:\nsee note below",
  "CP Lugs Installed @ 12 O'clock (RRJ ONLY)",
  "Ovality Check\n**",
  "Joint Air Test RRJ-WR ONLY\n(80kPa hold for 2 min)",
  "Internal Cement Liner\n(OK/Patch)",
  "Spark Testing\n(OK/Patched)",
  "NAME ",
  "SIGNATURE",
] as const;

/** Asterisk row per Excel: C=*, E=*, G=***, H=*, I=**, J=*, K=*(If Patched), L=* (If Patched). Indices 0-13. */
export const ASTERISK_ROW: Record<number, string> = {
  2: "*",
  4: "*",
  6: "***",
  7: "*",
  8: "**",
  9: "*",
  10: "*(If Patched)",
  11: "* (If Patched)",
};

export const NOTES = [
  "NOTE: * Has photo requirements.",
  "NOTE:** Measurements for Ovality check are to be done at evenly spaced intervals approximately 2Pi/3 around the inside of the pipe",
  "NOTE: *** Max deviation and deflection in WR joint is 1.1deg. Max Deflection in RRJ is 0.6deg. Max Deflection with Site Weld Band is 6 deg. No reverse grade permitted- Any exceedance in alignment to be RFI'd.",
] as const;
